
'use server';

import { connectToDatabase, toObjectId } from '@/lib/mongodb';
import type { ObjectId } from 'mongodb';

// Type definitions for data structures (can be shared or defined per component/action)
export interface DoctorPatient {
  _id: string; //ObjectId converted to string
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  lastActivity?: Date | string; // Ensure date is stringified if needed for client
  assignedDoctorId?: string;
  readmissionRisk?: 'low' | 'medium' | 'high';
  medicalHistory?: string;
}
interface RawDoctorPatient { // DB representation
  _id: ObjectId;
  name: string;
  email?: string;
  photoURL?: string;
  lastActivity?: Date;
  assignedDoctorId?: string;
  role: 'patient'; // for query
  readmissionRisk?: 'low' | 'medium' | 'high';
  medicalHistory?: string;
}


export interface DoctorPatientHealthData {
  _id: string; // ObjectId converted to string
  id: string;
  patientId: string; // ObjectId converted to string
  timestamp: Date | string;
  steps?: number;
  heartRate?: number;
}
interface RawDoctorPatientHealthData {
  _id: ObjectId;
  patientId: ObjectId;
  timestamp: Date;
  steps?: number;
  heartRate?: number;
}

export interface DoctorPatientMedication {
  _id: string; // ObjectId converted to string
  id: string;
  patientId: string; // ObjectId converted to string
  name: string;
  dosage: string;
  frequency: string;
  adherence?: number;
}
interface RawDoctorPatientMedication {
  _id: ObjectId;
  patientId: ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  adherence?: number;
}


export interface DoctorChatMessage {
  _id: string; // ObjectId converted to string
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date | string;
}
interface RawDoctorChatMessage {
  _id: ObjectId;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
}

export interface DoctorAISuggestion {
  _id: string; // ObjectId converted to string
  id: string;
  patientId: string; // ObjectId converted to string
  suggestionText: string;
  timestamp: Date | string;
  status: 'pending' | 'approved' | 'rejected';
}
interface RawDoctorAISuggestion {
  _id: ObjectId;
  patientId: ObjectId;
  suggestionText: string;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected';
}

const getChatId = (doctorId: string, patientId: string): string => {
  return [doctorId, patientId].sort().join('_');
};

export async function fetchDoctorPatientsAction(doctorId: string): Promise<{ patients?: DoctorPatient[], error?: string }> {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawDoctorPatient>('users');
    const patientList = await usersCollection.find({
      role: 'patient',
      assignedDoctorId: doctorId 
    }).toArray();

    const patients: DoctorPatient[] = patientList.map(p => ({
      ...p,
      _id: p._id.toString(),
      id: p._id.toString(),
      lastActivity: p.lastActivity?.toISOString(), // Ensure date is serializable
    }));
    return { patients };
  } catch (err: any) {
    console.error("Error fetching doctor's patients:", err);
    return { error: "Could not load patient list. " + err.message };
  }
}

export async function fetchDoctorPatientDetailsAction(patientIdStr: string, doctorId: string): Promise<{
  patient?: DoctorPatient,
  healthData?: DoctorPatientHealthData[],
  medications?: DoctorPatientMedication[],
  aiSuggestions?: DoctorAISuggestion[],
  chatMessages?: DoctorChatMessage[],
  error?: string
}> {
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: "Invalid patient ID format." };
  }

  try {
    const { db } = await connectToDatabase();

    const usersCollection = db.collection<RawDoctorPatient>('users');
    const rawPatient = await usersCollection.findOne({ _id: patientObjectId });
    const patient: DoctorPatient | undefined = rawPatient ? {
        ...rawPatient,
         _id: rawPatient._id.toString(),
         id: rawPatient._id.toString(),
         lastActivity: rawPatient.lastActivity?.toISOString()
        } : undefined;

    const healthCollection = db.collection<RawDoctorPatientHealthData>('healthData');
    const rawHealthData = await healthCollection.find({ patientId: patientObjectId })
      .sort({ timestamp: -1 }).limit(10).toArray();
    const healthData: DoctorPatientHealthData[] = rawHealthData.map(d => ({
        ...d,
         _id: d._id.toString(),
         id: d._id.toString(),
         patientId: d.patientId.toString(),
         timestamp: d.timestamp.toISOString()
        }));

    const medsCollection = db.collection<RawDoctorPatientMedication>('medications');
    const rawMeds = await medsCollection.find({ patientId: patientObjectId }).toArray();
    const medications: DoctorPatientMedication[] = rawMeds.map(med => ({
      ...med,
      _id: med._id.toString(),
      id: med._id.toString(),
      patientId: med.patientId.toString(),
      adherence: med.adherence ?? Math.floor(Math.random() * 31) + 70 // Keep simulation if original logic
    }));
    
    const suggestionsCollection = db.collection<RawDoctorAISuggestion>('aiSuggestions');
    const rawSuggestions = await suggestionsCollection.find({ patientId: patientObjectId })
      .sort({ timestamp: -1 }).toArray();
    const aiSuggestions: DoctorAISuggestion[] = rawSuggestions.map(s => ({
        ...s,
        _id: s._id.toString(),
        id: s._id.toString(),
        patientId: s.patientId.toString(),
        timestamp: s.timestamp.toISOString()
    }));

    const chatId = getChatId(doctorId, patientIdStr);
    const chatCollection = db.collection<RawDoctorChatMessage>('chatMessages');
    const rawMessages = await chatCollection.find({ chatId }).sort({ timestamp: 1 }).toArray();
    const chatMessages: DoctorChatMessage[] = rawMessages.map(m => ({
        ...m,
        _id: m._id.toString(),
        id: m._id.toString(),
        timestamp: m.timestamp.toISOString()
    }));
    
    return { patient, healthData, medications, aiSuggestions, chatMessages };

  } catch (err: any) {
    console.error("Error fetching patient details:", err);
    return { error: "Could not load patient data. " + err.message };
  }
}

export async function sendChatMessageAction(
  doctorId: string,
  doctorName: string,
  patientIdStr: string,
  text: string
): Promise<{ message?: DoctorChatMessage, error?: string }> {
  if (!text.trim()) return { error: "Message cannot be empty." };

  const chatId = getChatId(doctorId, patientIdStr);
  const messageData: Omit<RawDoctorChatMessage, '_id'> = { // Use Omit for data to be inserted
    chatId,
    senderId: doctorId,
    senderName: doctorName,
    text,
    timestamp: new Date(),
  };

  try {
    const { db } = await connectToDatabase();
    const chatCollection = db.collection<RawDoctorChatMessage>('chatMessages');
    const result = await chatCollection.insertOne(messageData as RawDoctorChatMessage); // Cast to include _id if MongoDB driver adds it pre-insert

    const insertedMessage: DoctorChatMessage = {
        ...messageData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
        timestamp: messageData.timestamp.toISOString()
    };
    return { message: insertedMessage };
  } catch (err: any) {
    console.error("Error sending message:", err);
    return { error: "Could not send message. " + err.message };
  }
}

export async function updateSuggestionStatusAction(
  suggestionIdStr: string,
  patientIdStr: string, // for verification against suggestion's patientId
  status: 'approved' | 'rejected'
): Promise<{ updatedSuggestion?: Partial<DoctorAISuggestion>, error?: string }> {
  const suggestionObjectId = toObjectId(suggestionIdStr);
  const patientObjectId = toObjectId(patientIdStr);

  if (!suggestionObjectId || !patientObjectId) {
    return { error: "Invalid ID format for suggestion or patient." };
  }

  try {
    const { db } = await connectToDatabase();
    const suggestionsCollection = db.collection<RawDoctorAISuggestion>('aiSuggestions');
    const updateResult = await suggestionsCollection.updateOne(
      { _id: suggestionObjectId, patientId: patientObjectId }, // ensure suggestion belongs to this patient
      { $set: { status: status } }
    );

    if (updateResult.matchedCount === 0) {
      return { error: "Suggestion not found or does not belong to the patient." };
    }
    if (updateResult.modifiedCount === 0) {
      return { error: "Suggestion status was already set to " + status + "." };
    }
    
    return { updatedSuggestion: { id: suggestionIdStr, status: status } };
  } catch (err: any) {
    console.error(`Error updating suggestion status:`, err);
    return { error: `Could not update suggestion status. ${err.message}` };
  }
}
