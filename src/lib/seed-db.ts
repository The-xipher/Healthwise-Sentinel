
'use server'; // Although this is a script, keeping it for consistency if parts are reused.

import { connectToDatabase, ObjectId } from './mongodb';
import { faker } from '@faker-js/faker';

// --- Configuration for Mock Data ---
const ADMIN_ID = new ObjectId('607f1f77bcf86cd799439010');
const PATIENT_ID_ALICE = new ObjectId('607f1f77bcf86cd799439011'); // For PatientDashboard
const DOCTOR_ID_SMITH = new ObjectId('607f1f77bcf86cd799439012'); // For DoctorDashboard

const PATIENT_ID_BOB = new ObjectId('607f1f77bcf86cd799439013');
const DOCTOR_ID_JONES = new ObjectId('607f1f77bcf86cd799439014');

const NUM_OTHER_PATIENTS = 3; // Will be assigned to Dr. Smith or Dr. Jones
const NUM_OTHER_DOCTORS = 1;

const CHAT_ID_SMITH_ALICE = [DOCTOR_ID_SMITH.toHexString(), PATIENT_ID_ALICE.toHexString()].sort().join('_');

async function seedDatabase() {
  try {
    const { db, client } = await connectToDatabase();
    console.log('Connected to database. Starting seeding process...');

    // Clear existing data
    console.log('Clearing existing collections...');
    await db.collection('users').deleteMany({});
    await db.collection('healthData').deleteMany({});
    await db.collection('medications').deleteMany({});
    await db.collection('symptomReports').deleteMany({});
    await db.collection('aiSuggestions').deleteMany({});
    await db.collection('chatMessages').deleteMany({});
    console.log('Collections cleared.');

    // --- Seed Users ---
    const usersToSeed = [];

    // Admin
    usersToSeed.push({
      _id: ADMIN_ID,
      email: 'admin@healthwise.com',
      displayName: 'Admin User',
      role: 'admin',
      creationTime: faker.date.past({ years: 1 }),
      photoURL: faker.image.avatar(),
    });

    // Doctors
    const drSmith = {
      _id: DOCTOR_ID_SMITH,
      email: 'dr.smith@healthwise.com',
      displayName: 'Dr. John Smith',
      role: 'doctor',
      creationTime: faker.date.past({ years: 2 }),
      photoURL: faker.image.avatar(),
    };
    usersToSeed.push(drSmith);

    const drJones = {
      _id: DOCTOR_ID_JONES,
      email: 'dr.jones@healthwise.com',
      displayName: 'Dr. Emily Jones',
      role: 'doctor',
      creationTime: faker.date.past({ years: 1 }),
      photoURL: faker.image.avatar(),
    };
    usersToSeed.push(drJones);

    const otherDoctorIds: ObjectId[] = [];
    for (let i = 0; i < NUM_OTHER_DOCTORS; i++) {
      const doctorId = new ObjectId();
      otherDoctorIds.push(doctorId);
      usersToSeed.push({
        _id: doctorId,
        email: faker.internet.email(),
        displayName: `Dr. ${faker.person.lastName()}`,
        role: 'doctor',
        creationTime: faker.date.past({ years: 1 }),
        photoURL: faker.image.avatar(),
      });
    }
    const allDoctorIds = [DOCTOR_ID_SMITH, DOCTOR_ID_JONES, ...otherDoctorIds];

    // Patients
    const patientAlice = {
      _id: PATIENT_ID_ALICE,
      email: 'alice.wonder@mail.com',
      displayName: 'Alice Wonderland',
      role: 'patient',
      assignedDoctorId: DOCTOR_ID_SMITH.toHexString(),
      creationTime: faker.date.past({ months: 6 }),
      photoURL: faker.image.avatar(),
      lastActivity: faker.date.recent({ days: 5 }),
      readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high']),
      medicalHistory: `Diagnosed with Type 2 Diabetes ${faker.number.int({ min: 1, max: 5 })} years ago. Past surgery: Appendectomy. Allergic to penicillin.`,
    };
    usersToSeed.push(patientAlice);

    const patientBob = {
      _id: PATIENT_ID_BOB,
      email: 'bob.builder@mail.com',
      displayName: 'Bob Builder',
      role: 'patient',
      assignedDoctorId: DOCTOR_ID_JONES.toHexString(),
      creationTime: faker.date.past({ months: 8 }),
      photoURL: faker.image.avatar(),
      lastActivity: faker.date.recent({ days: 3 }),
      readmissionRisk: faker.helpers.arrayElement(['low', 'medium']),
      medicalHistory: `History of hypertension. Recovering from minor cardiac event. No known allergies.`,
    };
    usersToSeed.push(patientBob);

    const otherPatientIds: ObjectId[] = [];
    for (let i = 0; i < NUM_OTHER_PATIENTS; i++) {
      const patientId = new ObjectId();
      otherPatientIds.push(patientId);
      usersToSeed.push({
        _id: patientId,
        email: faker.internet.email(),
        displayName: faker.person.fullName(),
        role: 'patient',
        assignedDoctorId: faker.helpers.arrayElement(allDoctorIds).toHexString(),
        creationTime: faker.date.past({ months: 10 }),
        photoURL: faker.image.avatar(),
        lastActivity: faker.date.recent({ days: 10 }),
        readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high']),
        medicalHistory: `Patient has a history of ${faker.lorem.words(3)}. Currently managing ${faker.lorem.words(2)}.`,
      });
    }
    const allPatientObjectIds = [PATIENT_ID_ALICE, PATIENT_ID_BOB, ...otherPatientIds];


    await db.collection('users').insertMany(usersToSeed);
    console.log(`${usersToSeed.length} users seeded.`);

    // --- Seed Health Data ---
    const healthDataToSeed = [];
    for (const patientId of allPatientObjectIds) {
      for (let i = 0; i < 30; i++) { // 30 days of data
        healthDataToSeed.push({
          _id: new ObjectId(),
          patientId: patientId,
          timestamp: faker.date.recent({ days: 30 - i }),
          steps: faker.number.int({ min: 1000, max: 15000 }),
          heartRate: faker.number.int({ min: 60, max: 120 }),
          bloodGlucose: faker.number.int({ min: 70, max: 180 }),
        });
      }
    }
    if (healthDataToSeed.length > 0) await db.collection('healthData').insertMany(healthDataToSeed);
    console.log(`${healthDataToSeed.length} health data records seeded.`);

    // --- Seed Medications ---
    const medicationsToSeed = [];
    const commonMeds = ['Metformin', 'Lisinopril', 'Atorvastatin', 'Amlodipine', 'Amoxicillin'];
    for (const patientId of allPatientObjectIds) {
      const numMeds = faker.number.int({ min: 1, max: 3 });
      for (let i = 0; i < numMeds; i++) {
        medicationsToSeed.push({
          _id: new ObjectId(),
          patientId: patientId,
          name: faker.helpers.arrayElement(commonMeds),
          dosage: `${faker.number.int({ min: 10, max: 100 })}mg`,
          frequency: faker.helpers.arrayElement(['Once daily', 'Twice daily', 'As needed']),
          lastTaken: faker.date.recent({ days: 1 }),
          adherence: faker.number.int({ min: 60, max: 100 }),
        });
      }
    }
    if (medicationsToSeed.length > 0) await db.collection('medications').insertMany(medicationsToSeed);
    console.log(`${medicationsToSeed.length} medication records seeded.`);

    // --- Seed Symptom Reports ---
    const symptomReportsToSeed = [];
    for (const patientId of [PATIENT_ID_ALICE, PATIENT_ID_BOB, ...otherPatientIds.slice(0,1)]) { // For a few patients
      for (let i = 0; i < faker.number.int({min: 1, max: 3}); i++) {
        symptomReportsToSeed.push({
          _id: new ObjectId(),
          patientId: patientId,
          userId: patientId.toHexString(), // Assuming patient reports for themselves
          timestamp: faker.date.recent({ days: 10 }),
          severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe'] as const),
          description: faker.lorem.sentence(),
        });
      }
    }
    if (symptomReportsToSeed.length > 0) await db.collection('symptomReports').insertMany(symptomReportsToSeed);
    console.log(`${symptomReportsToSeed.length} symptom reports seeded.`);

    // --- Seed AI Suggestions ---
    const aiSuggestionsToSeed = [];
     for (const patientId of [PATIENT_ID_ALICE, PATIENT_ID_BOB]) { // For specific patients relevant to DoctorDashboard
      for (let i = 0; i < faker.number.int({min:1, max: 2}); i++) {
        aiSuggestionsToSeed.push({
          _id: new ObjectId(),
          patientId: patientId,
          suggestionText: `Consider adjusting ${faker.helpers.arrayElement(commonMeds)} dosage due to ${faker.lorem.words(3)}.`,
          timestamp: faker.date.recent({ days: 5 }),
          status: faker.helpers.arrayElement(['pending', 'approved', 'rejected'] as const),
        });
      }
    }
    if (aiSuggestionsToSeed.length > 0) await db.collection('aiSuggestions').insertMany(aiSuggestionsToSeed);
    console.log(`${aiSuggestionsToSeed.length} AI suggestions seeded.`);

    // --- Seed Chat Messages --- (for Dr. Smith and Alice)
    const chatMessagesToSeed = [];
    for (let i = 0; i < 5; i++) {
      const isDoctorSender = i % 2 === 0;
      chatMessagesToSeed.push({
        _id: new ObjectId(),
        chatId: CHAT_ID_SMITH_ALICE,
        senderId: isDoctorSender ? DOCTOR_ID_SMITH.toHexString() : PATIENT_ID_ALICE.toHexString(),
        senderName: isDoctorSender ? drSmith.displayName : patientAlice.displayName,
        text: faker.lorem.sentence(),
        timestamp: faker.date.recent({ days: 2 }),
      });
    }
    if (chatMessagesToSeed.length > 0) await db.collection('chatMessages').insertMany(chatMessagesToSeed);
    console.log(`${chatMessagesToSeed.length} chat messages seeded for Dr. Smith and Alice.`);


    console.log('Database seeded successfully!');
    await client.close();
    console.log('MongoDB connection closed.');

  } catch (error) {
    console.error('Error seeding database:', error);
    if ((error as any).message.includes('queryTxt ETIMEOUT') || (error as any).message.includes('querySrv ENOTFOUND')) {
        console.error("DNS resolution or network timeout issue. Check your internet connection and MongoDB Atlas whitelist.");
    }
    process.exit(1);
  }
}

seedDatabase();
