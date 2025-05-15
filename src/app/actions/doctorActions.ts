
'use server';

import { connectToDatabase, toObjectId, ObjectId } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { formatDistanceToNow, parseISO } from 'date-fns';


// Type definitions for data structures (can be shared or defined per component/action)
export interface DoctorPatient {
  _id: string;
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  lastActivity?: Date | string;
  assignedDoctorId?: string;
  readmissionRisk?: 'low' | 'medium' | 'high';
  medicalHistory?: string;
  // For approved care plan display
  approvedCarePlanText?: string;
  carePlanLastUpdatedByDoctorId?: string;
  carePlanLastUpdatedByDoctorName?: string; // To show who approved it
  carePlanLastUpdatedDate?: Date | string;
}
interface RawDoctorPatient {
  _id: ObjectId;
  displayName: string;
  email?: string;
  photoURL?: string;
  lastActivity?: Date;
  assignedDoctorId?: string;
  role: 'patient';
  readmissionRisk?: 'low' | 'medium' | 'high';
  medicalHistory?: string;
  approvedCarePlanText?: string;
  carePlanLastUpdatedByDoctorId?: string;
  carePlanLastUpdatedDate?: Date;
}


export interface DoctorPatientHealthData {
  _id: string;
  id: string;
  patientId: string;
  timestamp: Date | string;
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number; // Added
}
interface RawDoctorPatientHealthData {
  _id: ObjectId;
  patientId: ObjectId;
  timestamp: Date;
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number; // Added
}

export interface DoctorPatientMedication {
  _id: string;
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  adherence?: number;
  reminderTimes?: string[]; // Added for display and management
  lastTaken?: string; // For display, from patient actions
}
interface RawDoctorPatientMedication {
  _id: ObjectId;
  patientId: ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  adherence?: number;
  reminderTimes?: string[];
  lastTaken?: Date;
}


export interface DoctorChatMessage {
  _id: string;
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: Date | string;
  isRead?: boolean;
}
interface RawDoctorChatMessage {
  _id: ObjectId;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: Date;
  isRead?: boolean;
}

export interface DoctorAISuggestion {
  _id: string;
  id: string;
  patientId: string;
  suggestionText: string;
  timestamp: Date | string;
  status: 'pending' | 'approved' | 'rejected';
  source?: string;
  symptomReportId?: string;
}
interface RawDoctorAISuggestion {
  _id: ObjectId;
  patientId: ObjectId;
  suggestionText: string;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected';
  source?: string;
  symptomReportId?: string;
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
  status: 'scheduled' | 'completed' | 'cancelled' | 'suggested';
  notes?: string;
}

export interface RawAppointment { // DB representation
  _id: ObjectId;
  patientId: ObjectId;
  patientName: string;
  doctorId: ObjectId;
  doctorName: string;
  appointmentDate: Date;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'suggested';
  notes?: string;
}


const getChatId = (id1: string, id2: string): string => {
  return [id1, id2].sort().join('_');
};

export async function fetchDoctorPatientsAction(doctorId: string): Promise<{ patients?: DoctorPatient[], error?: string }> {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawDoctorPatient>('users');
    const patientList = await usersCollection.find({
      role: 'patient',
      assignedDoctorId: doctorId
    }).toArray();

    const doctorObjectIds = patientList
      .map(p => p.carePlanLastUpdatedByDoctorId)
      .filter(id => id && ObjectId.isValid(id))
      .map(id => toObjectId(id!));

    let doctorMap: Map<string, string> = new Map();
    if (doctorObjectIds.length > 0) {
        const doctors = await usersCollection.find({ _id: { $in: doctorObjectIds } }).toArray();
        doctors.forEach(doc => doctorMap.set(doc._id.toString(), doc.displayName || 'Unknown Doctor'));
    }


    const patients: DoctorPatient[] = patientList.map(p => ({
      ...p,
      _id: p._id.toString(),
      id: p._id.toString(),
      name: p.displayName || 'Unknown Patient',
      lastActivity: p.lastActivity?.toISOString(),
      carePlanLastUpdatedDate: p.carePlanLastUpdatedDate?.toISOString(),
      carePlanLastUpdatedByDoctorName: p.carePlanLastUpdatedByDoctorId ? doctorMap.get(p.carePlanLastUpdatedByDoctorId) : undefined,
    }));
    return { patients };
  } catch (err: any) {
    console.error("Error fetching doctor's patients:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
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

    const rawPatient = await usersCollection.findOne({ _id: patientObjectId, assignedDoctorId: doctorId, role: 'patient' });

    if (!rawPatient) {
      const anyPatientWithId = await usersCollection.findOne({ _id: patientObjectId, role: 'patient' });
      if (!anyPatientWithId) {
        return { error: "Patient not found." };
      }
      return { error: "Patient not assigned to this doctor." };
    }

    let carePlanDoctorName: string | undefined = undefined;
    if (rawPatient.carePlanLastUpdatedByDoctorId) {
        const carePlanDoctor = await usersCollection.findOne({ _id: toObjectId(rawPatient.carePlanLastUpdatedByDoctorId) });
        carePlanDoctorName = carePlanDoctor?.displayName;
    }


    const patient: DoctorPatient = {
        ...rawPatient,
         _id: rawPatient._id.toString(),
         id: rawPatient._id.toString(),
         name: rawPatient.displayName || 'Unknown Patient',
         lastActivity: rawPatient.lastActivity?.toISOString(),
         carePlanLastUpdatedDate: rawPatient.carePlanLastUpdatedDate?.toISOString(),
         carePlanLastUpdatedByDoctorName: carePlanDoctorName,
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
      adherence: med.adherence ?? Math.floor(Math.random() * 31) + 70,
      reminderTimes: med.reminderTimes || [],
      lastTaken: med.lastTaken?.toISOString()
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
     if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
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
    revalidatePath(`/dashboard/doctor`);
    revalidatePath(`/dashboard/patient`);
    return { message: insertedMessage };
  } catch (err: any) {
    console.error("Error sending message:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
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
    revalidatePath(`/dashboard/doctor?patientId=${patientIdStr}`);
    revalidatePath(`/dashboard/patient`); // Revalidate patient dashboard too
    return { updatedSuggestion: { id: suggestionIdStr, status: status } };
  } catch (err: any)
{
    console.error(`Error updating suggestion status:`, err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
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
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not load appointments. " + (err.message || '') };
  }
}

export async function createAppointmentAction(appointmentData: {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string; // ISO Date string
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'suggested';
  notes?: string;
}): Promise<{ appointment?: Appointment, error?: string }> {

  const patientObjectId = toObjectId(appointmentData.patientId);
  const doctorObjectId = toObjectId(appointmentData.doctorId);

  if (!patientObjectId || !doctorObjectId) {
    return { error: "Invalid Patient or Doctor ID format." };
  }

  const rawAppointmentData: Omit<RawAppointment, '_id'> = {
    patientId: patientObjectId,
    patientName: appointmentData.patientName,
    doctorId: doctorObjectId,
    doctorName: appointmentData.doctorName,
    appointmentDate: new Date(appointmentData.appointmentDate),
    reason: appointmentData.reason,
    status: appointmentData.status,
    notes: appointmentData.notes,
  };

  try {
    const { db } = await connectToDatabase();
    const appointmentsCollection = db.collection<RawAppointment>('appointments');
    const result = await appointmentsCollection.insertOne(rawAppointmentData as RawAppointment);

    const insertedAppointment: Appointment = {
      ...rawAppointmentData,
      _id: result.insertedId.toString(),
      id: result.insertedId.toString(),
      patientId: rawAppointmentData.patientId.toString(),
      doctorId: rawAppointmentData.doctorId.toString(),
      appointmentDate: rawAppointmentData.appointmentDate.toISOString(),
    };
    revalidatePath(`/dashboard/doctor`);
    return { appointment: insertedAppointment };
  } catch (err: any) {
    console.error("Error creating appointment:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not create appointment. " + (err.message || '') };
  }
}

export async function fetchFullPatientHealthDataAction(patientIdStr: string): Promise<{ healthData?: DoctorPatientHealthData[], error?: string }> {
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: "Invalid patient ID format." };
  }

  try {
    const { db } = await connectToDatabase();
    const healthCollection = db.collection<RawDoctorPatientHealthData>('healthData');
    const rawHealthData = await healthCollection.find({ patientId: patientObjectId })
      .sort({ timestamp: -1 }).limit(50).toArray();

    const healthData: DoctorPatientHealthData[] = rawHealthData.map(d => ({
      ...d,
      _id: d._id.toString(),
      id: d._id.toString(),
      patientId: d.patientId.toString(),
      timestamp: d.timestamp.toISOString()
    }));
    return { healthData };
  } catch (err: any) {
    console.error("Error fetching full patient health data:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not load full health data. " + (err.message || '') };
  }
}

export async function approveCarePlanAction(
  patientIdStr: string,
  carePlanText: string,
  doctorId: string
): Promise<{ success: boolean; error?: string; updatedPatient?: Partial<DoctorPatient> }> {
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { success: false, error: "Invalid patient ID format." };
  }
  if (!carePlanText.trim()) {
    return { success: false, error: "Care plan text cannot be empty." };
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawDoctorPatient>('users');

    const updateResult = await usersCollection.updateOne(
      { _id: patientObjectId, role: 'patient' },
      {
        $set: {
          approvedCarePlanText: carePlanText,
          carePlanLastUpdatedByDoctorId: doctorId,
          carePlanLastUpdatedDate: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return { success: false, error: "Patient not found." };
    }
    if (updateResult.modifiedCount === 0) {
        return { success: true, updatedPatient: { approvedCarePlanText: carePlanText } };
    }

    revalidatePath(`/dashboard/doctor?patientId=${patientIdStr}`);

    return { success: true, updatedPatient: {
        approvedCarePlanText: carePlanText,
        carePlanLastUpdatedByDoctorId: doctorId,
        carePlanLastUpdatedDate: new Date().toISOString(),
      }
    };
  } catch (err: any) {
    console.error("Error approving care plan:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { success: false, error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { success: false, error: "Could not approve care plan. " + (err.message || '') };
  }
}


// --- Medication Management Actions ---

export async function addPatientMedicationAction(
  patientIdStr: string,
  medicationData: { name: string; dosage: string; frequency: string; reminderTimes?: string[] }
): Promise<{ medication?: DoctorPatientMedication; error?: string }> {
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: 'Invalid patient ID.' };
  }
  if (!medicationData.name || !medicationData.dosage || !medicationData.frequency) {
    return { error: 'Medication name, dosage, and frequency are required.' };
  }

  const newMed: Omit<RawDoctorPatientMedication, '_id'> = {
    patientId: patientObjectId,
    name: medicationData.name,
    dosage: medicationData.dosage,
    frequency: medicationData.frequency,
    reminderTimes: medicationData.reminderTimes || [],
    adherence: 100, // Default adherence for new medication
    lastTaken: undefined,
  };

  try {
    const { db } = await connectToDatabase();
    const medicationsCollection = db.collection<RawDoctorPatientMedication>('medications');
    const result = await medicationsCollection.insertOne(newMed as RawDoctorPatientMedication);

    const insertedMed: DoctorPatientMedication = {
      ...newMed,
      _id: result.insertedId.toString(),
      id: result.insertedId.toString(),
      patientId: newMed.patientId.toString(),
      reminderTimes: newMed.reminderTimes || [],
    };
    revalidatePath(`/dashboard/doctor?patientId=${patientIdStr}`);
    revalidatePath(`/dashboard/patient`);
    return { medication: insertedMed };
  } catch (error: any) {
    console.error('Error adding medication:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: 'Could not add medication. ' + error.message };
  }
}

export async function updatePatientMedicationAction(
  medicationIdStr: string,
  patientIdStr: string, // For revalidation path and ensuring correct patient context
  medicationData: Partial<{ name: string; dosage: string; frequency: string; reminderTimes: string[] }>
): Promise<{ medication?: DoctorPatientMedication; error?: string }> {
  const medicationObjectId = toObjectId(medicationIdStr);
  if (!medicationObjectId) {
    return { error: 'Invalid medication ID.' };
  }

  const updateFields: Partial<RawDoctorPatientMedication> = {};
  if (medicationData.name) updateFields.name = medicationData.name;
  if (medicationData.dosage) updateFields.dosage = medicationData.dosage;
  if (medicationData.frequency) updateFields.frequency = medicationData.frequency;
  if (medicationData.reminderTimes) updateFields.reminderTimes = medicationData.reminderTimes;


  if (Object.keys(updateFields).length === 0) {
    return { error: 'No fields to update.' };
  }

  try {
    const { db } = await connectToDatabase();
    const medicationsCollection = db.collection<RawDoctorPatientMedication>('medications');
    const result = await medicationsCollection.findOneAndUpdate(
      { _id: medicationObjectId },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return { error: 'Medication not found or update failed.' };
    }
    
    const updatedMed: DoctorPatientMedication = {
      ...result,
      _id: result._id.toString(),
      id: result._id.toString(),
      patientId: result.patientId.toString(),
      reminderTimes: result.reminderTimes || [],
      lastTaken: result.lastTaken?.toISOString()
    };

    revalidatePath(`/dashboard/doctor?patientId=${patientIdStr}`);
    revalidatePath(`/dashboard/patient`);
    return { medication: updatedMed };
  } catch (error: any) {
    console.error('Error updating medication:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: 'Could not update medication. ' + error.message };
  }
}

export async function deletePatientMedicationAction(
  medicationIdStr: string,
  patientIdStr: string // For revalidation path
): Promise<{ success: boolean; error?: string }> {
  const medicationObjectId = toObjectId(medicationIdStr);
  if (!medicationObjectId) {
    return { success: false, error: 'Invalid medication ID.' };
  }

  try {
    const { db } = await connectToDatabase();
    const medicationsCollection = db.collection<RawDoctorPatientMedication>('medications');
    const result = await medicationsCollection.deleteOne({ _id: medicationObjectId });

    if (result.deletedCount === 0) {
      return { success: false, error: 'Medication not found or already deleted.' };
    }
    revalidatePath(`/dashboard/doctor?patientId=${patientIdStr}`);
    revalidatePath(`/dashboard/patient`);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting medication:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { success: false, error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { success: false, error: 'Could not delete medication. ' + error.message };
  }
}
