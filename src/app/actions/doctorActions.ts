
'use server';

import { connectToDatabase, toObjectId, ObjectId } from '@/lib/mongodb';

// Type definitions for data structures (can be shared or defined per component/action)
export interface DoctorPatient {
  _id: string;
  id: string;
  name: string; // This is what the component expects
  email?: string;
  photoURL?: string;
  lastActivity?: Date | string;
  assignedDoctorId?: string;
  readmissionRisk?: 'low' | 'medium' | 'high';
  medicalHistory?: string;
}
interface RawDoctorPatient { // Represents the structure in MongoDB
  _id: ObjectId;
  displayName: string; // MongoDB stores names as displayName
  email?: string;
  photoURL?: string;
  lastActivity?: Date;
  assignedDoctorId?: string;
  role: 'patient';
  readmissionRisk?: 'low' | 'medium' | 'high';
  medicalHistory?: string;
}


export interface DoctorPatientHealthData {
  _id: string;
  id: string;
  patientId: string;
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
  _id: string;
  id: string;
  patientId: string;
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
  _id: string;
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string; // Added
  text: string;
  timestamp: Date | string;
  isRead?: boolean; // Added
}
interface RawDoctorChatMessage {
  _id: ObjectId;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string; // Added
  text: string;
  timestamp: Date;
  isRead?: boolean; // Added
}

export interface DoctorAISuggestion {
  _id: string;
  id: string;
  patientId: string;
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

export interface Appointment {
  _id: string;
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string; // ISO string
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

interface RawAppointment { // DB representation
  _id: ObjectId;
  patientId: ObjectId; // Changed from string to ObjectId
  patientName: string;
  doctorId: ObjectId;   // Changed from string to ObjectId
  doctorName: string;
  appointmentDate: Date;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}


const getChatId = (id1: string, id2: string): string => {
  return [id1, id2].sort().join('_');
};

export async function fetchDoctorPatientsAction(doctorId: string): Promise<{ patients?: DoctorPatient[], error?: string }> {
  try {
    const { db } = await connectToDatabase();
    // Fetch users with role 'patient' and assignedDoctorId, expecting 'displayName'
    const usersCollection = db.collection<RawDoctorPatient>('users');
    const patientList = await usersCollection.find({
      role: 'patient',
      assignedDoctorId: doctorId
    }).toArray();

    // Map RawDoctorPatient (with displayName) to DoctorPatient (with name)
    const patients: DoctorPatient[] = patientList.map(p => ({
      ...p,
      _id: p._id.toString(),
      id: p._id.toString(),
      name: p.displayName || 'Unknown Patient', // Ensure 'name' is always a string
      lastActivity: p.lastActivity?.toISOString(),
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
    const usersCollection = db.collection<RawDoctorPatient>('users'); // Expects RawDoctorPatient

    const rawPatient = await usersCollection.findOne({ _id: patientObjectId, assignedDoctorId: doctorId, role: 'patient' });

    if (!rawPatient) {
      const anyPatientWithId = await usersCollection.findOne({ _id: patientObjectId, role: 'patient' });
      if (!anyPatientWithId) {
        return { error: "Patient not found." };
      }
      return { error: "Patient not assigned to this doctor." };
    }

    // Map RawDoctorPatient to DoctorPatient
    const patient: DoctorPatient = {
        ...rawPatient,
         _id: rawPatient._id.toString(),
         id: rawPatient._id.toString(),
         name: rawPatient.displayName || 'Unknown Patient', // Ensure 'name' is always a string
         lastActivity: rawPatient.lastActivity?.toISOString()
    };

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
      adherence: med.adherence ?? Math.floor(Math.random() * 31) + 70
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
  const messageData: Omit<RawDoctorChatMessage, '_id'> = {
    chatId,
    senderId: doctorId,
    senderName: doctorName,
    receiverId: patientIdStr,
    text,
    timestamp: new Date(),
    isRead: false,
  };

  try {
    const { db } = await connectToDatabase();
    const chatCollection = db.collection<RawDoctorChatMessage>('chatMessages');
    const result = await chatCollection.insertOne(messageData as RawDoctorChatMessage);

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
  patientIdStr: string,
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
      { _id: suggestionObjectId, patientId: patientObjectId },
      { $set: { status: status } }
    );

    if (updateResult.matchedCount === 0) {
      return { error: "Suggestion not found or does not belong to the patient." };
    }
    if (updateResult.modifiedCount === 0 && updateResult.upsertedCount === 0) {
      const existingSuggestion = await suggestionsCollection.findOne({ _id: suggestionObjectId });
      if (existingSuggestion && existingSuggestion.status === status) {
         return { updatedSuggestion: { id: suggestionIdStr, status: status } };
      }
      return { error: "Suggestion status was not changed. It might already be " + status + "." };
    }

    return { updatedSuggestion: { id: suggestionIdStr, status: status } };
  } catch (err: any)
{
    console.error(`Error updating suggestion status:`, err);
    return { error: `Could not update suggestion status. ${err.message}` };
  }
}

export async function fetchDoctorAppointmentsAction(doctorId: string): Promise<{ appointments?: Appointment[], error?: string }> {
  const doctorObjectId = toObjectId(doctorId);
  if (!doctorObjectId) {
    return { error: "Invalid doctor ID format." };
  }

  try {
    const { db } = await connectToDatabase();
    const appointmentsCollection = db.collection<RawAppointment>('appointments');
    const rawAppointments = await appointmentsCollection.find({ doctorId: doctorObjectId, status: 'scheduled' })
      .sort({ appointmentDate: 1 }).toArray();

    const appointments: Appointment[] = rawAppointments.map(appt => ({
      ...appt,
      _id: appt._id.toString(),
      id: appt._id.toString(),
      patientId: appt.patientId.toString(),
      doctorId: appt.doctorId.toString(),
      appointmentDate: appt.appointmentDate.toISOString(),
    }));
    return { appointments };
  } catch (err: any) {
    console.error("Error fetching doctor's appointments:", err);
    return { error: "Could not load appointments. " + (err.message || '') };
  }
}
