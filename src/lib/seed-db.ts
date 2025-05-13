
// src/lib/seed-db.ts
import { MongoClient, ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';
import { connectToDatabase } from './mongodb'; // Use existing connection helper

// Define interfaces for mock data
interface User {
  _id: ObjectId;
  email: string; 
  displayName: string;
  photoURL: string;
  role: 'patient' | 'doctor' | 'admin';
  assignedDoctorId?: string; // For patients
  assignedDoctorName?: string; // For patients, to simplify chat display
  specialty?: string; // For doctors
  readmissionRisk?: 'low' | 'medium' | 'high'; // For patients
  medicalHistory?: string; // For patients
  lastActivity?: Date;
  creationTime: Date;
  lastSignInTime: Date;
}

interface Credential {
  _id: ObjectId;
  userId: ObjectId; // Foreign key to users collection
  email: string; // Login email (must be unique)
  passwordSalt?: string; 
  passwordHash?: string; 
  passwordPlainText: string; 
}

interface HealthData {
  _id: ObjectId;
  patientId: ObjectId;
  timestamp: Date;
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number;
}

interface Medication {
  _id: ObjectId;
  patientId: ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  lastTaken?: Date;
  adherence?: number; // Percentage
}

interface SymptomReport {
  _id: ObjectId;
  patientId: ObjectId;
  userId: string; 
  timestamp: Date;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
}

interface AISuggestion {
    _id: ObjectId;
    patientId: ObjectId;
    suggestionText: string;
    timestamp: Date;
    status: 'pending' | 'approved' | 'rejected';
}

interface ChatMessage {
    _id: ObjectId;
    chatId: string; 
    senderId: string;
    senderName: string;
    receiverId: string; // Added to know who the message is for, helps with notifications potentially
    text: string;
    timestamp: Date;
    isRead?: boolean; // Added for potential notification system
}


const NUM_PATIENTS = 5; 
const NUM_DOCTORS = 2;
const NUM_ADMINS = 1;
const HEALTH_DATA_POINTS_PER_PATIENT = 20;
const MEDICATIONS_PER_PATIENT = 2;
const SYMPTOMS_PER_PATIENT = 1;
const AI_SUGGESTIONS_PER_PATIENT = 2;
const CHAT_MESSAGES_PER_PATIENT_DOCTOR_PAIR = 5; // Increased for more chat history

const DEFAULT_PASSWORD = "password123";

// Predefined ObjectIDs for consistent test users
const patientUserObjectId1 = new ObjectId("607f1f77bcf86cd799439011"); // Patient Zero
const doctorUserObjectId1 = new ObjectId("607f1f77bcf86cd799439012"); // Dr. Ada Lovelace
const adminUserObjectId1 = new ObjectId("607f1f77bcf86cd799439013"); // Admin User
const patientUserObjectId2 = new ObjectId("607f1f77bcf86cd799439014"); // Second patient
const doctorUserObjectId2 = new ObjectId("607f1f77bcf86cd799439015"); // Second doctor

const getChatId = (id1: string, id2: string): string => {
  return [id1, id2].sort().join('_');
};

export async function seedDatabase(): Promise<{ success: boolean; message: string; error?: string }> {
  let client: MongoClient | null = null;
  try {
    const { client: connectedClient, db } = await connectToDatabase();
    client = connectedClient;

    console.log('Starting database seed process...');

    const collectionsToClear = [
      'users', 'credentials', 'healthData', 'medications', 
      'symptomReports', 'aiSuggestions', 'chatMessages'
    ];
    console.log(`Clearing existing data from collections: ${collectionsToClear.join(', ')}...`);
    for (const coll of collectionsToClear) {
      await db.collection(coll).deleteMany({});
    }
    console.log('Existing data cleared.');

    const usersToInsert: User[] = [];
    const credentialsToInsert: Credential[] = [];
    
    const healthDataEntries: HealthData[] = [];
    const medicationEntries: Medication[] = [];
    const symptomReportEntries: SymptomReport[] = [];
    const aiSuggestionEntries: AISuggestion[] = [];
    const chatMessageEntries: ChatMessage[] = [];

    // --- Admins ---
    const adminUser: User = {
      _id: adminUserObjectId1,
      email: 'admin@healthwise.com', // For display/contact
      displayName: 'Admin User',
      photoURL: faker.image.avatarGitHub(),
      role: 'admin',
      creationTime: faker.date.past({ years: 1 }),
      lastSignInTime: faker.date.recent({ days: 5 }),
      lastActivity: faker.date.recent({ days: 5 }),
    };
    usersToInsert.push(adminUser);
    credentialsToInsert.push({
      _id: new ObjectId(),
      userId: adminUser._id,
      email: 'admin@healthwise.com', // Login email
      passwordPlainText: DEFAULT_PASSWORD,
    });

    // --- Doctors ---
    const doctorsForAssignment: User[] = [];
    const doctor1: User = {
      _id: doctorUserObjectId1,
      email: 'dr.ada.lovelace@healthwise.com',
      displayName: 'Dr. Ada Lovelace',
      photoURL: faker.image.avatar(),
      role: 'doctor',
      specialty: 'Cardiology',
      creationTime: faker.date.past({ years: 2 }),
      lastSignInTime: faker.date.recent({ days: 2 }),
      lastActivity: faker.date.recent({ days: 2 }),
    };
    usersToInsert.push(doctor1);
    doctorsForAssignment.push(doctor1);
    credentialsToInsert.push({
      _id: new ObjectId(),
      userId: doctor1._id,
      email: 'dr.ada.lovelace@healthwise.com',
      passwordPlainText: DEFAULT_PASSWORD,
    });

    const doctor2: User = {
        _id: doctorUserObjectId2,
        email: `dr.john.doe@healthwise.com`,
        displayName: `Dr. John Doe`,
        photoURL: faker.image.avatar(),
        role: 'doctor',
        specialty: 'General Practice',
        creationTime: faker.date.past({ years: 1 }),
        lastSignInTime: faker.date.recent({ days: 3 }),
        lastActivity: faker.date.recent({ days: 3 }),
    };
    usersToInsert.push(doctor2);
    doctorsForAssignment.push(doctor2);
    credentialsToInsert.push({
      _id: new ObjectId(),
      userId: doctor2._id,
      email: `dr.john.doe@healthwise.com`,
      passwordPlainText: DEFAULT_PASSWORD,
    });
    
    // --- Patients ---
    const patientData = [
      { _id: patientUserObjectId1, displayName: 'Patient Zero', loginEmail: 'patient.zero@healthwise.com', assignedDoctorIndex: 0 },
      { _id: patientUserObjectId2, displayName: 'Jane Smith', loginEmail: 'jane.smith@healthwise.com', assignedDoctorIndex: 1 },
      // Add more distinct patients
      { _id: new ObjectId(), displayName: faker.person.fullName(), loginEmail: `patient${usersToInsert.length+1}@healthwise.com`, assignedDoctorIndex: 0 },
      { _id: new ObjectId(), displayName: faker.person.fullName(), loginEmail: `patient${usersToInsert.length+2}@healthwise.com`, assignedDoctorIndex: 1 },
      { _id: new ObjectId(), displayName: faker.person.fullName(), loginEmail: `patient${usersToInsert.length+3}@healthwise.com`, assignedDoctorIndex: 0 },
    ];

    for (const pData of patientData) {
      const assignedDoctor = doctorsForAssignment[pData.assignedDoctorIndex % doctorsForAssignment.length];
      
      const patient: User = {
        _id: pData._id,
        email: pData.loginEmail.replace('@', '.contact@'), // Different from login email for variation
        displayName: pData.displayName,
        photoURL: faker.image.avatar(),
        role: 'patient',
        assignedDoctorId: assignedDoctor._id.toString(),
        assignedDoctorName: assignedDoctor.displayName,
        readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high']),
        medicalHistory: `Diagnosed with ${faker.lorem.words(2)}. Previous procedure: ${faker.lorem.words(3)} on ${faker.date.past().toLocaleDateString()}. Known allergies: ${faker.lorem.word()}.`,
        creationTime: faker.date.past({ years: 1 }),
        lastSignInTime: faker.date.recent({ days: 7 }),
        lastActivity: faker.date.recent({ days: 1 }),
      };
      usersToInsert.push(patient);
      credentialsToInsert.push({
        _id: new ObjectId(),
        userId: patient._id,
        email: pData.loginEmail, // Unique login email
        passwordPlainText: DEFAULT_PASSWORD,
      });

      // Health Data
      for (let j = 0; j < HEALTH_DATA_POINTS_PER_PATIENT; j++) {
        healthDataEntries.push({
          _id: new ObjectId(),
          patientId: patient._id,
          timestamp: faker.date.recent({ days: 30 - j }), // Spread out over last 30 days
          steps: faker.number.int({ min: 500, max: 15000 }),
          heartRate: faker.number.int({ min: 50, max: 120 }),
          bloodGlucose: faker.number.int({ min: 70, max: 180 }),
        });
      }

      // Medications
      for (let k = 0; k < MEDICATIONS_PER_PATIENT; k++) {
        medicationEntries.push({
          _id: new ObjectId(),
          patientId: patient._id,
          name: faker.commerce.productName(),
          dosage: `${faker.number.int({ min: 1, max: 2 })} tab(s)`,
          frequency: `${faker.number.int({ min: 1, max: 3 })} times daily`,
          lastTaken: faker.date.recent({ days: 1 }),
          adherence: faker.number.int({ min: 60, max: 100 }),
        });
      }

      // Symptom Reports
      for (let l = 0; l < SYMPTOMS_PER_PATIENT; l++) {
        symptomReportEntries.push({
          _id: new ObjectId(),
          patientId: patient._id,
          userId: patient._id.toString(),
          timestamp: faker.date.recent({ days: 7 }),
          severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe']),
          description: faker.lorem.sentence(),
        });
      }
      
      // AI Suggestions
      for (let m = 0; m < AI_SUGGESTIONS_PER_PATIENT; m++) {
          aiSuggestionEntries.push({
              _id: new ObjectId(),
              patientId: patient._id,
              suggestionText: `Consider ${faker.lorem.words(4)} due to recent ${faker.lorem.word()}.`,
              timestamp: faker.date.recent({days: 3}),
              status: faker.helpers.arrayElement(['pending', 'approved', 'rejected'])
          });
      }

      // Chat Messages
      const chatId = getChatId(assignedDoctor._id.toString(), patient._id.toString());
      const conversationParticipants = [
          { id: patient._id.toString(), name: patient.displayName },
          { id: assignedDoctor._id.toString(), name: assignedDoctor.displayName }
      ];

      for (let n = 0; n < CHAT_MESSAGES_PER_PATIENT_DOCTOR_PAIR; n++) {
          const sender = faker.helpers.arrayElement(conversationParticipants);
          const receiver = conversationParticipants.find(u => u.id !== sender.id)!;
          
          chatMessageEntries.push({
              _id: new ObjectId(),
              chatId: chatId,
              senderId: sender.id,
              senderName: sender.name,
              receiverId: receiver.id,
              text: faker.lorem.sentence({min: 3, max: 15}),
              timestamp: faker.date.recent({days: CHAT_MESSAGES_PER_PATIENT_DOCTOR_PAIR - n}), // Chronological
              isRead: faker.datatype.boolean(0.7) // 70% chance of being read
          });
      }
    }

    console.log('Inserting mock data into collections...');
    if (usersToInsert.length > 0) await db.collection('users').insertMany(usersToInsert);
    if (credentialsToInsert.length > 0) await db.collection('credentials').insertMany(credentialsToInsert);
    if (healthDataEntries.length > 0) await db.collection('healthData').insertMany(healthDataEntries);
    if (medicationEntries.length > 0) await db.collection('medications').insertMany(medicationEntries);
    if (symptomReportEntries.length > 0) await db.collection('symptomReports').insertMany(symptomReportEntries);
    if (aiSuggestionEntries.length > 0) await db.collection('aiSuggestions').insertMany(aiSuggestionEntries);
    if (chatMessageEntries.length > 0) await db.collection('chatMessages').insertMany(chatMessageEntries);

    console.log('Mock data insertion complete.');
    console.log(`Seeded ${usersToInsert.length} users.`);
    console.log(`Seeded ${credentialsToInsert.length} credentials.`);
    console.log(`Seeded ${chatMessageEntries.length} chat messages.`);
    
    return { success: true, message: `Database seeded successfully! Users: ${usersToInsert.length}, Credentials: ${credentialsToInsert.length}, Chats: ${chatMessageEntries.length}` };

  } catch (error: any) {
    const errorMessage = `Error during database seeding: ${error.message}`;
    console.error(errorMessage, error);
    return { success: false, message: 'Database seeding failed.', error: error.message };
  }
}

// If run directly via `tsx src/lib/seed-db.ts`
if (require.main === module) {
  (async () => {
    console.log("Running seed script directly...");
    const result = await seedDatabase();
    if (result.success) {
      console.log(result.message);
      process.exit(0);
    } else {
      console.error(result.message, result.error || '');
      process.exit(1);
    }
  })();
}
