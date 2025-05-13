
'use server';

import { connectToDatabase, toObjectId, ObjectId } from '@/lib/mongodb';


export interface PatientHealthData {
  _id: string;
  id: string;
  patientId: string;
  timestamp: string; 
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number;
}
interface RawPatientHealthData { 
  _id: ObjectId;
  patientId: ObjectId;
  timestamp: Date;
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number;
}


export interface PatientMedication {
  _id: string;
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  lastTaken?: string; 
  adherence?: number;
}
interface RawPatientMedication { 
  _id: ObjectId;
  patientId: ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  lastTaken?: Date;
  adherence?: number;
}

export interface PatientSymptomReport {
  _id: string;
  id: string;
  patientId: string;
  timestamp: string; 
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  userId: string; 
}
interface RawPatientSymptomReport { 
  _id: ObjectId;
  patientId: ObjectId;
  timestamp: Date;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  userId: string; 
}

export interface PatientChatMessage {
  _id: string;
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: string; // Dates should be stringified
  isRead?: boolean;
}
interface RawPatientChatMessage { // DB representation
  _id: ObjectId;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: Date;
  isRead?: boolean;
}

interface PatientProfile { // For fetching patient details including assigned doctor
    _id: ObjectId;
    displayName: string;
    assignedDoctorId?: string;
    assignedDoctorName?: string;
    // other fields if needed
}

const getChatId = (id1: string, id2: string): string => {
  return [id1, id2].sort().join('_');
};


export async function fetchPatientDashboardDataAction(patientIdStr: string): Promise<{
  healthData?: PatientHealthData[],
  medications?: PatientMedication[],
  symptomReports?: PatientSymptomReport[],
  chatMessages?: PatientChatMessage[],
  assignedDoctorId?: string,
  assignedDoctorName?: string,
  patientDisplayName?: string,
  error?: string
}> {
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: "Invalid patient ID format." };
  }

  try {
    const { db } = await connectToDatabase();

    // Fetch patient profile to get assigned doctor info
    const usersCollection = db.collection<PatientProfile>('users');
    const patientProfile = await usersCollection.findOne({ _id: patientObjectId });

    if (!patientProfile) {
        return { error: "Patient profile not found." };
    }
    
    const patientDisplayName = patientProfile.displayName;
    const assignedDoctorId = patientProfile.assignedDoctorId;
    const assignedDoctorName = patientProfile.assignedDoctorName;


    const healthCollection = db.collection<RawPatientHealthData>('healthData');
    const rawHealthData = await healthCollection.find({ patientId: patientObjectId })
      .sort({ timestamp: -1 }).limit(30).toArray();
    const healthData: PatientHealthData[] = rawHealthData.reverse().map(d => ({
        ...d,
        _id: d._id.toString(),
        id: d._id.toString(),
        patientId: d.patientId.toString(),
        timestamp: d.timestamp.toISOString()
    }));

    const medsCollection = db.collection<RawPatientMedication>('medications');
    const rawMeds = await medsCollection.find({ patientId: patientObjectId }).toArray();
    const medications: PatientMedication[] = rawMeds.map(med => ({
      ...med,
      _id: med._id.toString(),
      id: med._id.toString(),
      patientId: med.patientId.toString(),
      lastTaken: med.lastTaken?.toISOString(),
      adherence: med.adherence ?? Math.floor(Math.random() * 41) + 60 
    }));

    const symptomsCollection = db.collection<RawPatientSymptomReport>('symptomReports');
    const rawSymptoms = await symptomsCollection.find({ patientId: patientObjectId })
      .sort({ timestamp: -1 }).limit(5).toArray();
    const symptomReports: PatientSymptomReport[] = rawSymptoms.map(s => ({
        ...s,
         _id: s._id.toString(),
         id: s._id.toString(),
         patientId: s.patientId.toString(),
         timestamp: s.timestamp.toISOString()
    }));

    let chatMessages: PatientChatMessage[] = [];
    if (assignedDoctorId) {
        const chatId = getChatId(patientIdStr, assignedDoctorId);
        const chatCollection = db.collection<RawPatientChatMessage>('chatMessages');
        const rawMessages = await chatCollection.find({ chatId }).sort({ timestamp: 1 }).toArray();
        chatMessages = rawMessages.map(m => ({
            ...m,
            _id: m._id.toString(),
            id: m._id.toString(),
            timestamp: m.timestamp.toISOString()
        }));
    }


    return { 
        healthData, 
        medications, 
        symptomReports, 
        chatMessages, 
        assignedDoctorId, 
        assignedDoctorName,
        patientDisplayName
    };
  } catch (err: any) {
    console.error("Error fetching patient dashboard data:", err);
    return { error: "Could not load patient data. " + err.message };
  }
}

export async function submitSymptomReportAction(
  patientIdStr: string,
  severity: 'mild' | 'moderate' | 'severe',
  description: string
): Promise<{ report?: PatientSymptomReport, error?: string }> {
  
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: "Invalid patient ID format." };
  }

  const reportData: Omit<RawPatientSymptomReport, '_id'> = {
    patientId: patientObjectId,
    timestamp: new Date(),
    severity,
    description,
    userId: patientIdStr, 
  };

  try {
    const { db } = await connectToDatabase();
    const symptomsCollection = db.collection<RawPatientSymptomReport>('symptomReports');
    const result = await symptomsCollection.insertOne(reportData as RawPatientSymptomReport);
    
    const insertedReport: PatientSymptomReport = {
        ...reportData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
        patientId: reportData.patientId.toString(),
        timestamp: reportData.timestamp.toISOString()
    };
    return { report: insertedReport };
  } catch (err: any) {
    console.error("Error submitting symptom report:", err);
    return { error: "Could not save your report. " + err.message };
  }
}

export async function sendPatientChatMessageAction(
  patientId: string,
  patientName: string,
  doctorId: string,
  text: string
): Promise<{ message?: PatientChatMessage, error?: string }> {
  if (!text.trim()) return { error: "Message cannot be empty." };
  if (!patientId || !doctorId) return { error: "Patient or Doctor ID missing."};

  const chatId = getChatId(patientId, doctorId);
  const messageData: Omit<RawPatientChatMessage, '_id'> = {
    chatId,
    senderId: patientId,
    senderName: patientName,
    receiverId: doctorId,
    text,
    timestamp: new Date(),
    isRead: false,
  };

  try {
    const { db } = await connectToDatabase();
    const chatCollection = db.collection<RawPatientChatMessage>('chatMessages');
    const result = await chatCollection.insertOne(messageData as RawPatientChatMessage);

    const insertedMessage: PatientChatMessage = {
        ...messageData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
        timestamp: messageData.timestamp.toISOString()
    };
    return { message: insertedMessage };
  } catch (err: any) {
    console.error("Error sending patient message:", err);
    return { error: "Could not send message. " + err.message };
  }
}
```