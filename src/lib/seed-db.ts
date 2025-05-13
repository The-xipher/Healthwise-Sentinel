// src/lib/seed-db.ts
import { MongoClient, ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';
import { connectToDatabase } from './mongodb'; // Use existing connection helper

// Define interfaces for mock data
interface User {
  _id: ObjectId;
  // id: string; // id will be _id.toString()
  email: string; // Keep email for display/contact, but login uses credentials.email
  displayName: string;
  photoURL: string;
  role: 'patient' | 'doctor' | 'admin';
  assignedDoctorId?: string; // For patients
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
  passwordSalt?: string; // For future hashing, not used for plain text
  passwordHash?: string; // For future hashing, not used for plain text
  passwordPlainText: string; // For simple mock login
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
    text: string;
    timestamp: Date;
}


const NUM_PATIENTS = 5; // Reduced for faster seeding if needed
const NUM_DOCTORS = 2;
const NUM_ADMINS = 1;
const HEALTH_DATA_POINTS_PER_PATIENT = 20;
const MEDICATIONS_PER_PATIENT = 2;
const SYMPTOMS_PER_PATIENT = 1;
const AI_SUGGESTIONS_PER_PATIENT = 2;
const CHAT_MESSAGES_PER_PATIENT_DOCTOR_PAIR = 3;

const DEFAULT_PASSWORD = "password123";

// Predefined ObjectIDs for consistent test users
const patientUserObjectId = new ObjectId("607f1f77bcf86cd799439011");
const doctorUserObjectId = new ObjectId("607f1f77bcf86cd799439012");
const adminUserObjectId = new ObjectId("607f1f77bcf86cd799439013");


export async function seedDatabase(): Promise<{ success: boolean; message: string; error?: string }> {
  let client: MongoClient | null = null;
  try {
    const { client: connectedClient, db } = await connectToDatabase();
    client = connectedClient;

    console.log('Starting database seed process...');

    console.log('Clearing existing data...');
    await db.collection('users').deleteMany({});
    await db.collection('credentials').deleteMany({}); // Clear credentials
    await db.collection('healthData').deleteMany({});
    await db.collection('medications').deleteMany({});
    await db.collection('symptomReports').deleteMany({});
    await db.collection('aiSuggestions').deleteMany({});
    await db.collection('chatMessages').deleteMany({});
    console.log('Existing data cleared.');

    const usersToInsert: User[] = [];
    const credentialsToInsert: Credential[] = [];
    const doctorsForAssignment: User[] = [];


    // Create Admin User and Credential
    const adminEmail = 'admin@healthwise.com';
    const adminUser: User = {
      _id: adminUserObjectId,
      email: adminEmail,
      displayName: 'Admin User',
      photoURL: faker.image.avatar(),
      role: 'admin',
      creationTime: faker.date.past(),
      lastSignInTime: faker.date.recent(),
      lastActivity: faker.date.recent(),
    };
    usersToInsert.push(adminUser);
    credentialsToInsert.push({
      _id: new ObjectId(),
      userId: adminUser._id,
      email: adminEmail,
      passwordPlainText: DEFAULT_PASSWORD,
    });

    // Create Doctor Users and Credentials
    for (let i = 0; i < NUM_DOCTORS; i++) {
      const doctorEmail = i === 0 ? 'doctor@healthwise.com' : `doctor${i+1}@healthwise.com`;
      const doctorId = i === 0 ? doctorUserObjectId : new ObjectId();
      const doctor: User = {
        _id: doctorId,
        email: doctorEmail,
        displayName: i === 0 ? 'Dr. Ada Lovelace' : `Dr. ${faker.person.lastName()}`,
        photoURL: faker.image.avatar(),
        role: 'doctor',
        specialty: faker.person.jobArea(),
        creationTime: faker.date.past(),
        lastSignInTime: faker.date.recent(),
        lastActivity: faker.date.recent(),
      };
      usersToInsert.push(doctor);
      doctorsForAssignment.push(doctor);
      credentialsToInsert.push({
        _id: new ObjectId(),
        userId: doctor._id,
        email: doctorEmail,
        passwordPlainText: DEFAULT_PASSWORD,
      });
    }
    
    const healthDataEntries: HealthData[] = [];
    const medicationEntries: Medication[] = [];
    const symptomReportEntries: SymptomReport[] = [];
    const aiSuggestionEntries: AISuggestion[] = [];
    const chatMessageEntries: ChatMessage[] = [];

    // Create Patient Users and Credentials
    for (let i = 0; i < NUM_PATIENTS; i++) {
      const assignedDoctor = doctorsForAssignment[i % doctorsForAssignment.length];
      const patientEmail = i === 0 ? 'patient@healthwise.com' : `patient${i+1}@healthwise.com`;
      const patientId = i === 0 ? patientUserObjectId : new ObjectId();
      
      const patient: User = {
        _id: patientId,
        email: patientEmail,
        displayName: i === 0 ? 'Patient Zero' : faker.person.fullName(),
        photoURL: faker.image.avatar(),
        role: 'patient',
        assignedDoctorId: assignedDoctor._id.toString(),
        readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high']),
        medicalHistory: `Diagnosed with ${faker.lorem.words(2)}. Previous procedure: ${faker.lorem.words(3)} on ${faker.date.past().toLocaleDateString()}. Known allergies: ${faker.lorem.word()}.`,
        creationTime: faker.date.past(),
        lastSignInTime: faker.date.recent(),
        lastActivity: faker.date.recent(),
      };
      usersToInsert.push(patient);
      credentialsToInsert.push({
        _id: new ObjectId(),
        userId: patient._id,
        email: patientEmail,
        passwordPlainText: DEFAULT_PASSWORD,
      });

      // Generate Health Data for each patient
      for (let j = 0; j < HEALTH_DATA_POINTS_PER_PATIENT; j++) {
        healthDataEntries.push({
          _id: new ObjectId(),
          patientId: patient._id,
          timestamp: faker.date.recent({ days: 30 }),
          steps: faker.number.int({ min: 500, max: 15000 }),
          heartRate: faker.number.int({ min: 50, max: 120 }),
          bloodGlucose: faker.number.int({ min: 70, max: 180 }),
        });
      }

      // Generate Medications for each patient
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

      // Generate Symptom Reports for each patient
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
      
      // Generate AI Suggestions for each patient
      for (let m = 0; m < AI_SUGGESTIONS_PER_PATIENT; m++) {
          aiSuggestionEntries.push({
              _id: new ObjectId(),
              patientId: patient._id,
              suggestionText: `Consider ${faker.lorem.words(4)} due to recent ${faker.lorem.word()}.`,
              timestamp: faker.date.recent({days: 3}),
              status: faker.helpers.arrayElement(['pending', 'approved', 'rejected'])
          });
      }

      // Generate Chat Messages between patient and assigned doctor
      const chatId = [assignedDoctor._id.toString(), patient._id.toString()].sort().join('_');
      for (let n = 0; n < CHAT_MESSAGES_PER_PATIENT_DOCTOR_PAIR; n++) {
          const isDoctorSender = faker.datatype.boolean();
          chatMessageEntries.push({
              _id: new ObjectId(),
              chatId: chatId,
              senderId: isDoctorSender ? assignedDoctor._id.toString() : patient._id.toString(),
              senderName: isDoctorSender ? assignedDoctor.displayName : patient.displayName,
              text: faker.lorem.sentence(),
              timestamp: faker.date.recent({days: 2})
          });
      }
    }

    console.log('Inserting mock data...');
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
    // ... other logs ...
    
    return { success: true, message: 'Database seeded successfully with users and credentials!' };

  } catch (error: any) {
    const errorMessage = `Error during database seeding: ${error.message}`;
    console.error(errorMessage, error);
    return { success: false, message: 'Database seeding failed.', error: error.message };
  }
}

if (require.main === module) {
  (async () => {
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
