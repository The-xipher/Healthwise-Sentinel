
// src/lib/seed-db.ts
import { MongoClient, ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';
import { connectToDatabase } from './mongodb'; // Use existing connection helper
import type { Appointment as ApptInterface, RawAppointment as RawApptInterface } from '@/app/actions/doctorActions'; // Import appointment types


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
    receiverId: string; 
    text: string;
    timestamp: Date;
    isRead?: boolean; 
}

// Use the imported types for Appointment
type Appointment = ApptInterface;
type RawAppointment = RawApptInterface;


const DEFAULT_PASSWORD = "password123";

// Predefined ObjectIDs for consistent test users
const patientUserObjectId1 = new ObjectId("607f1f77bcf86cd799439011"); 
const doctorUserObjectId1 = new ObjectId("607f1f77bcf86cd799439012"); 
const adminUserObjectId1 = new ObjectId("607f1f77bcf86cd799439013"); 
const patientUserObjectId2 = new ObjectId("607f1f77bcf86cd799439014"); 
const doctorUserObjectId2 = new ObjectId("607f1f77bcf86cd799439015"); 
const patientUserObjectId3 = new ObjectId("607f1f77bcf86cd799439016");
const patientUserObjectId4 = new ObjectId("607f1f77bcf86cd799439017");
const patientUserObjectId5 = new ObjectId("607f1f77bcf86cd799439018");


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
      'symptomReports', 'aiSuggestions', 'chatMessages', 'appointments'
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
    const appointmentEntries: RawAppointment[] = [];


    // --- Admins ---
    const adminUser: User = {
      _id: adminUserObjectId1,
      email: 'admin.user@healthwise.com', // For display/contact
      displayName: 'Admin User',
      photoURL: `https://placehold.co/100x100.png?text=AU`, dataAIHint: 'profile admin',
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
      email: 'evelyn.reed.md@healthwise.com',
      displayName: 'Dr. Evelyn Reed',
      photoURL: `https://placehold.co/100x100.png?text=ER`, dataAIHint: 'profile doctor',
      role: 'doctor',
      specialty: 'Cardiology',
      creationTime: faker.date.past({ years: 5 }),
      lastSignInTime: faker.date.recent({ days: 1 }),
      lastActivity: faker.date.recent({ days: 1 }),
    };
    usersToInsert.push(doctor1);
    doctorsForAssignment.push(doctor1);
    credentialsToInsert.push({
      _id: new ObjectId(),
      userId: doctor1._id,
      email: 'dr.reed@healthwise.com', // Login email
      passwordPlainText: DEFAULT_PASSWORD,
    });

    const doctor2: User = {
        _id: doctorUserObjectId2,
        email: `ben.carter.md@healthwise.com`,
        displayName: `Dr. Ben Carter`,
        photoURL: `https://placehold.co/100x100.png?text=BC`, dataAIHint: 'profile doctor',
        role: 'doctor',
        specialty: 'Pulmonology',
        creationTime: faker.date.past({ years: 3 }),
        lastSignInTime: faker.date.recent({ days: 2 }),
        lastActivity: faker.date.recent({ days: 2 }),
    };
    usersToInsert.push(doctor2);
    doctorsForAssignment.push(doctor2);
    credentialsToInsert.push({
      _id: new ObjectId(),
      userId: doctor2._id,
      email: `dr.carter@healthwise.com`, // Login email
      passwordPlainText: DEFAULT_PASSWORD,
    });
    
    // --- Patients ---
    const patientSeedDetails = [
      { 
        _id: patientUserObjectId1, 
        displayName: 'Ethan Carter', 
        loginEmail: 'ethan.carter@healthwise.com', 
        assignedDoctorIndex: 0, // Dr. Reed
        medicalHistory: "History of hypertension. Underwent cardiac catheterization 6 months ago. Allergic to penicillin.",
        photoInitial: "EC"
      },
      { 
        _id: patientUserObjectId2, 
        displayName: 'Olivia Rodriguez', 
        loginEmail: 'olivia.rodriguez@healthwise.com', 
        assignedDoctorIndex: 1, // Dr. Carter
        medicalHistory: "Diagnosed with Asthma, type 2 Diabetes. Previous hospitalization for asthma exacerbation.",
        photoInitial: "OR"
      },
      { 
        _id: patientUserObjectId3, 
        displayName: 'Liam Chen', 
        loginEmail: 'liam.chen@healthwise.com', 
        assignedDoctorIndex: 0, // Dr. Reed
        medicalHistory: "Recovering from a mild heart attack (MI). Prescribed beta-blockers and statins. No known allergies.",
        photoInitial: "LC"
      },
      { 
        _id: patientUserObjectId4, 
        displayName: 'Sophia Patel', 
        loginEmail: 'sophia.patel@healthwise.com', 
        assignedDoctorIndex: 1, // Dr. Carter
        medicalHistory: "Chronic Obstructive Pulmonary Disease (COPD). Uses an inhaler daily. History of smoking.",
        photoInitial: "SP"
      },
      { 
        _id: patientUserObjectId5, 
        displayName: 'Noah Williams', 
        loginEmail: 'noah.williams@healthwise.com', 
        assignedDoctorIndex: 0, // Dr. Reed
        medicalHistory: "Atrial fibrillation. On anticoagulants. Follow-up appointment scheduled for next month.",
        photoInitial: "NW"
      },
    ];

    for (const pData of patientSeedDetails) {
      const assignedDoctor = doctorsForAssignment[pData.assignedDoctorIndex];
      
      const patient: User = {
        _id: pData._id,
        email: pData.loginEmail.replace('@', '.contact@'), 
        displayName: pData.displayName,
        photoURL: `https://placehold.co/100x100.png?text=${pData.photoInitial}`, dataAIHint: 'profile patient',
        role: 'patient',
        assignedDoctorId: assignedDoctor._id.toString(),
        assignedDoctorName: assignedDoctor.displayName,
        readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high']),
        medicalHistory: pData.medicalHistory,
        creationTime: faker.date.past({ years: 1 }),
        lastSignInTime: faker.date.recent({ days: Math.floor(Math.random() * 7) + 1 }),
        lastActivity: faker.date.recent({ days: Math.floor(Math.random() * 3) + 1 }),
      };
      usersToInsert.push(patient);
      credentialsToInsert.push({
        _id: new ObjectId(),
        userId: patient._id,
        email: pData.loginEmail, 
        passwordPlainText: DEFAULT_PASSWORD,
      });

      // Health Data (more varied)
      for (let j = 0; j < 20; j++) {
        healthDataEntries.push({
          _id: new ObjectId(),
          patientId: patient._id,
          timestamp: faker.date.recent({ days: 30 - j }),
          steps: faker.number.int({ min: (patient.displayName === 'Ethan Carter' ? 2000: 1000) , max: (patient.displayName === 'Ethan Carter' ? 12000: 8000) }),
          heartRate: faker.number.int({ min: (patient.displayName.includes('Carter') || patient.displayName.includes('Chen') ? 55 : 65), max: (patient.displayName.includes('Carter') || patient.displayName.includes('Chen') ? 100 : 110) }),
          bloodGlucose: patient.medicalHistory.includes('Diabetes') ? faker.number.int({ min: 90, max: 220 }) : faker.number.int({ min: 70, max: 120 }),
        });
      }

      // Medications (more specific)
      const commonMeds = [
        { name: 'Lisinopril', dosage: '10mg Tablet', frequency: 'Once daily' },
        { name: 'Metformin', dosage: '500mg Tablet', frequency: 'Twice daily' },
        { name: 'Atorvastatin', dosage: '20mg Tablet', frequency: 'Once daily at bedtime' },
        { name: 'Albuterol Inhaler', dosage: '2 puffs', frequency: 'As needed for shortness of breath' },
        { name: 'Aspirin', dosage: '81mg Tablet', frequency: 'Once daily' },
        { name: 'Warfarin', dosage: '5mg Tablet', frequency: 'Once daily, dose adjusted by INR' }
      ];
      for (let k = 0; k < 2; k++) {
        const medTemplate = faker.helpers.arrayElement(commonMeds);
        medicationEntries.push({
          _id: new ObjectId(),
          patientId: patient._id,
          name: medTemplate.name,
          dosage: medTemplate.dosage,
          frequency: medTemplate.frequency,
          lastTaken: faker.date.recent({ days: 1 }),
          adherence: faker.number.int({ min: 65, max: 98 }),
        });
      }
      // Ensure patients with specific conditions get relevant meds
      if (patient.medicalHistory.includes('hypertension') && !medicationEntries.find(m=>m.patientId.equals(patient._id) && m.name === 'Lisinopril')) {
        medicationEntries.push({...commonMeds[0], _id: new ObjectId(), patientId: patient._id, lastTaken: faker.date.recent({ days: 1 }), adherence: faker.number.int({ min: 70, max: 95 }) });
      }
      if (patient.medicalHistory.includes('Diabetes') && !medicationEntries.find(m=>m.patientId.equals(patient._id) && m.name === 'Metformin')) {
         medicationEntries.push({...commonMeds[1], _id: new ObjectId(), patientId: patient._id, lastTaken: faker.date.recent({ days: 1 }), adherence: faker.number.int({ min: 70, max: 95 }) });
      }


      // Symptom Reports (more varied)
      const symptomTemplates = [
        { severity: 'mild', description: "Slight headache in the morning." },
        { severity: 'moderate', description: "Feeling more tired than usual today, some shortness of breath after walking." },
        { severity: 'severe', description: "Experiencing chest pain and dizziness. Called emergency services." },
        { severity: 'mild', description: "Occasional cough, mostly dry."}
      ]
      for (let l = 0; l < 1; l++) { // 1 report per patient for brevity
        const reportTemplate = faker.helpers.arrayElement(symptomTemplates);
        symptomReportEntries.push({
          _id: new ObjectId(),
          patientId: patient._id,
          userId: patient._id.toString(),
          timestamp: faker.date.recent({ days: 7 }),
          severity: reportTemplate.severity as 'mild' | 'moderate' | 'severe',
          description: reportTemplate.description,
        });
      }
      
      // AI Suggestions (more specific)
      const suggestionTexts = [
          `Monitor blood pressure closely due to recent high readings. Consider adjusting medication if trend continues.`,
          `Encourage patient ${pData.displayName} to increase daily fluid intake to prevent dehydration, especially with current medication regimen.`,
          `Review patient ${pData.displayName}'s diet for sodium content; aim for less than 2000mg/day.`,
          `Schedule a follow-up for ${pData.displayName} in 2 weeks to discuss medication adherence and symptom progression.`
      ]
      for (let m = 0; m < 2; m++) {
          aiSuggestionEntries.push({
              _id: new ObjectId(),
              patientId: patient._id,
              suggestionText: faker.helpers.arrayElement(suggestionTexts),
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
      const chatTemplates = [
          "Hello Dr. {doctorName}, I'm feeling a bit {symptom} today.",
          "Good morning {patientName}. How are you managing your {condition}?",
          "Just checking in, {patientName}. Remember to take your {medication} as prescribed.",
          "Dr. {doctorName}, I have a question about the side effects of {medication}.",
          "Thanks for the update, {patientName}. Let's monitor that for the next 24 hours.",
          "Hi {patientName}, your latest readings look stable. Keep up the good work!",
          "Dr. {doctorName}, I missed my morning dose of {medication}. What should I do?",
          "No problem {patientName}, take it as soon as you remember, unless it's almost time for your next dose."
      ];

      for (let n = 0; n < 5; n++) { // 5 messages per pair
          const sender = faker.helpers.arrayElement(conversationParticipants);
          const receiver = conversationParticipants.find(u => u.id !== sender.id)!;
          
          let text = faker.helpers.arrayElement(chatTemplates);
          text = text.replace("{doctorName}", assignedDoctor.displayName)
                     .replace("{patientName}", patient.displayName)
                     .replace("{symptom}", faker.helpers.arrayElement(["dizzy", "tired", "better", "a bit off"]))
                     .replace("{condition}", faker.helpers.arrayElement(["blood pressure", "sugar levels", "breathing"]))
                     .replace("{medication}", (medicationEntries.find(m => m.patientId.equals(patient._id))?.name || "medication"));
          
          chatMessageEntries.push({
              _id: new ObjectId(),
              chatId: chatId,
              senderId: sender.id,
              senderName: sender.name,
              receiverId: receiver.id,
              text: text,
              timestamp: faker.date.recent({days: 5 - n}), 
              isRead: n < 3 // Mark first few as read, last few as potentially unread
          });
      }

       // Seed Appointments
      if (pData._id === patientUserObjectId1 || pData._id === patientUserObjectId3) { // For Dr. Reed's patients
        appointmentEntries.push({
          _id: new ObjectId(),
          patientId: pData._id,
          patientName: pData.displayName,
          doctorId: doctorUserObjectId1,
          doctorName: doctor1.displayName,
          appointmentDate: faker.date.soon({ days: 7, refDate: new Date() }),
          reason: `Follow-up for ${pData.medicalHistory.split('.')[0]}`,
          status: 'scheduled',
          notes: 'Routine check-up.',
        });
      }
      if (pData._id === patientUserObjectId2 || pData._id === patientUserObjectId4) { // For Dr. Carter's patients
        appointmentEntries.push({
          _id: new ObjectId(),
          patientId: pData._id,
          patientName: pData.displayName,
          doctorId: doctorUserObjectId2,
          doctorName: doctor2.displayName,
          appointmentDate: faker.date.soon({ days: 10, refDate: new Date() }),
          reason: `Consultation regarding ${pData.medicalHistory.split('.')[0]}`,
          status: 'scheduled',
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
    if (appointmentEntries.length > 0) await db.collection('appointments').insertMany(appointmentEntries);


    console.log('Mock data insertion complete.');
    console.log(`Seeded ${usersToInsert.length} users.`);
    console.log(`Seeded ${credentialsToInsert.length} credentials.`);
    console.log(`Seeded ${chatMessageEntries.length} chat messages.`);
    console.log(`Seeded ${appointmentEntries.length} appointments.`);
    
    return { success: true, message: `Database seeded successfully! Users: ${usersToInsert.length}, Credentials: ${credentialsToInsert.length}, Health Data: ${healthDataEntries.length}, Medications: ${medicationEntries.length}, Symptoms: ${symptomReportEntries.length}, AI Suggestions: ${aiSuggestionEntries.length}, Chats: ${chatMessageEntries.length}, Appointments: ${appointmentEntries.length}` };

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
