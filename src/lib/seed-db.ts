// src/lib/seed-db.ts
import { MongoClient, ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';
import { connectToDatabase } from './mongodb'; // Use existing connection helper

// Define interfaces for mock data (can be expanded)
interface User {
  _id: ObjectId;
  id: string;
  email: string;
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
  userId: string; // Could be patient's own ID or a caregiver's
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
    chatId: string; // composite key like doctorId_patientId
    senderId: string;
    senderName: string;
    text: string;
    timestamp: Date;
}


const NUM_PATIENTS = 10;
const NUM_DOCTORS = 3;
const NUM_ADMINS = 1;
const HEALTH_DATA_POINTS_PER_PATIENT = 50;
const MEDICATIONS_PER_PATIENT = 3;
const SYMPTOMS_PER_PATIENT = 2;
const AI_SUGGESTIONS_PER_PATIENT = 3;
const CHAT_MESSAGES_PER_PATIENT_DOCTOR_PAIR = 5;


// Predefined IDs for consistent testing
const placeholderPatientId = new ObjectId('607f1f77bcf86cd799439011');
const placeholderDoctorId = new ObjectId('607f1f77bcf86cd799439012');
const placeholderAdminId = new ObjectId('607f1f77bcf86cd799439013');


export async function seedDatabase(): Promise<{ success: boolean; message: string; error?: string }> {
  let client: MongoClient | null = null;
  try {
    const { client: connectedClient, db } = await connectToDatabase();
    client = connectedClient;

    console.log('Starting database seed process...');

    // Clear existing collections
    console.log('Clearing existing data...');
    await db.collection('users').deleteMany({});
    await db.collection('healthData').deleteMany({});
    await db.collection('medications').deleteMany({});
    await db.collection('symptomReports').deleteMany({});
    await db.collection('aiSuggestions').deleteMany({});
    await db.collection('chatMessages').deleteMany({});
    console.log('Existing data cleared.');

    const users: User[] = [];
    const doctors: User[] = [];

    // Create Admins
    for (let i = 0; i < NUM_ADMINS; i++) {
      const isAdminPlaceholder = i === 0;
      const adminId = isAdminPlaceholder ? placeholderAdminId : new ObjectId();
      users.push({
        _id: adminId,
        id: adminId.toString(),
        email: isAdminPlaceholder ? 'admin@example.com' : faker.internet.email(),
        displayName: isAdminPlaceholder ? 'Admin User' : faker.person.fullName(),
        photoURL: faker.image.avatar(),
        role: 'admin',
        creationTime: faker.date.past(),
        lastSignInTime: faker.date.recent(),
        lastActivity: faker.date.recent(),
      });
    }

    // Create Doctors
    for (let i = 0; i < NUM_DOCTORS; i++) {
      const isDoctorPlaceholder = i === 0;
      const doctorId = isDoctorPlaceholder ? placeholderDoctorId : new ObjectId();
      const doctor: User = {
        _id: doctorId,
        id: doctorId.toString(),
        email: isDoctorPlaceholder ? 'dr.smith@example.com' : faker.internet.email(),
        displayName: isDoctorPlaceholder ? 'Dr. John Smith' : `Dr. ${faker.person.lastName()}`,
        photoURL: faker.image.avatar(),
        role: 'doctor',
        specialty: faker.person.jobTitle(), // Simplified, actual specialties might be from a list
        creationTime: faker.date.past(),
        lastSignInTime: faker.date.recent(),
        lastActivity: faker.date.recent(),
      };
      users.push(doctor);
      doctors.push(doctor);
    }
    
    // Create Patients and their related data
    const healthDataEntries: HealthData[] = [];
    const medicationEntries: Medication[] = [];
    const symptomReportEntries: SymptomReport[] = [];
    const aiSuggestionEntries: AISuggestion[] = [];
    const chatMessageEntries: ChatMessage[] = [];

    for (let i = 0; i < NUM_PATIENTS; i++) {
      const assignedDoctor = doctors[i % doctors.length]; // Assign patients to doctors cyclically
      const isPatientPlaceholder = i === 0;
      const patientId = isPatientPlaceholder ? placeholderPatientId : new ObjectId();
      
      const patient: User = {
        _id: patientId,
        id: patientId.toString(),
        email: isPatientPlaceholder ? 'patient.doe@example.com' : faker.internet.email(),
        displayName: isPatientPlaceholder ? 'Jane Doe' : faker.person.fullName(),
        photoURL: faker.image.avatar(),
        role: 'patient',
        assignedDoctorId: assignedDoctor._id.toString(),
        readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high']),
        medicalHistory: `Diagnosed with ${faker.lorem.words(3)}. Previous surgery on ${faker.date.past().toLocaleDateString()}. Allergic to ${faker.lorem.word()}.`,
        creationTime: faker.date.past(),
        lastSignInTime: faker.date.recent(),
        lastActivity: faker.date.recent(),
      };
      users.push(patient);

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
          name: faker.commerce.productName(), // Using product name as placeholder for drug name
          dosage: `${faker.number.int({ min: 1, max: 2 })} pills`,
          frequency: `${faker.number.int({ min: 1, max: 3 })} times a day`,
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
              suggestionText: `Consider ${faker.lorem.sentence(5)} based on recent activity.`,
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
    if (users.length > 0) await db.collection('users').insertMany(users);
    if (healthDataEntries.length > 0) await db.collection('healthData').insertMany(healthDataEntries);
    if (medicationEntries.length > 0) await db.collection('medications').insertMany(medicationEntries);
    if (symptomReportEntries.length > 0) await db.collection('symptomReports').insertMany(symptomReportEntries);
    if (aiSuggestionEntries.length > 0) await db.collection('aiSuggestions').insertMany(aiSuggestionEntries);
    if (chatMessageEntries.length > 0) await db.collection('chatMessages').insertMany(chatMessageEntries);

    console.log('Mock data insertion complete.');
    console.log(`Seeded ${users.length} users.`);
    console.log(`Seeded ${healthDataEntries.length} health data records.`);
    console.log(`Seeded ${medicationEntries.length} medication records.`);
    console.log(`Seeded ${symptomReportEntries.length} symptom reports.`);
    console.log(`Seeded ${aiSuggestionEntries.length} AI suggestions.`);
    console.log(`Seeded ${chatMessageEntries.length} chat messages.`);
    
    return { success: true, message: 'Database seeded successfully!' };

  } catch (error: any) {
    const errorMessage = `Error during database seeding: ${error.message}`;
    console.error(errorMessage, error);
    return { success: false, message: 'Database seeding failed.', error: error.message };
  } finally {
    // The connectToDatabase helper manages the connection lifecycle
    // so we don't necessarily need to close it here if it's meant to be cached.
    // If this seed script is run standalone and connectToDatabase doesn't cache/reuse,
    // then client.close() would be appropriate.
    // For now, assume connectToDatabase handles caching and lifecycle.
    // if (client) {
    //   await client.close();
    //   console.log('MongoDB connection closed.');
    // }
  }
}

// If this script is run directly (e.g. `tsx src/lib/seed-db.ts`)
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
