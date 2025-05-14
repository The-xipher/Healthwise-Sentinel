
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

interface PatientUserForAlerts { // For fetching patient details including assigned doctor and emergency contact
    _id: ObjectId;
    displayName: string;
    assignedDoctorId?: string;
    assignedDoctorName?: string; // For direct use in alert messages
    emergencyContactNumber?: string;
    // other fields if needed
}

export interface PatientApprovedAISuggestion {
  _id: string;
  id: string;
  patientId: string;
  suggestionText: string;
  timestamp: string; // ISO string from Date
}

interface RawPatientApprovedAISuggestion {
  _id: ObjectId;
  patientId: ObjectId; // Should match the patientId being queried
  suggestionText: string;
  timestamp: Date;
  status: 'approved'; // We will query for this status
}


const getChatId = (id1: string, id2: string): string => {
  return [id1, id2].sort().join('_');
};


export async function fetchPatientDashboardDataAction(patientIdStr: string): Promise<{
  healthData?: PatientHealthData[],
  medications?: PatientMedication[],
  symptomReports?: PatientSymptomReport[],
  chatMessages?: PatientChatMessage[],
  approvedAISuggestions?: PatientApprovedAISuggestion[],
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
    const usersCollection = db.collection<PatientUserForAlerts>('users'); 
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

    const approvedAISuggestionsCollection = db.collection<RawPatientApprovedAISuggestion>('aiSuggestions');
    const rawApprovedSuggestions = await approvedAISuggestionsCollection
      .find({ patientId: patientObjectId, status: 'approved' })
      .sort({ timestamp: -1 })
      .limit(5) // Get latest 5 approved suggestions
      .toArray();
    const approvedAISuggestions: PatientApprovedAISuggestion[] = rawApprovedSuggestions.map(s => ({
      _id: s._id.toString(),
      id: s._id.toString(),
      patientId: s.patientId.toString(),
      suggestionText: s.suggestionText,
      timestamp: s.timestamp.toISOString(),
    }));


    return {
        healthData,
        medications,
        symptomReports,
        chatMessages,
        approvedAISuggestions,
        assignedDoctorId,
        assignedDoctorName,
        patientDisplayName
    };
  } catch (err: any) {
    console.error("Error fetching patient dashboard data:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not load patient data. " + (err.message || '') };
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

    if (severity === 'severe') {
      // Fetch patient details for alert
      const usersCollection = db.collection<PatientUserForAlerts>('users');
      const patient = await usersCollection.findOne({ _id: patientObjectId });

      if (patient) {
        console.log(`PATIENT ACTION: SEVERE SYMPTOM REPORTED FOR ${patient.displayName} (ID: ${patientIdStr})`);
        if (patient.emergencyContactNumber) {
          console.log(`PATIENT ACTION: SIMULATED URGENT SMS to ${patient.emergencyContactNumber}: Patient ${patient.displayName} reported severe symptoms: "${description}". Please check on them.`);
        } else {
          console.log(`PATIENT ACTION: Patient ${patient.displayName} does not have an emergency contact number listed.`);
        }
        console.error(`PATIENT ACTION: CRITICAL HEALTH ALERT: Patient ${patient.displayName} reported severe symptoms: "${description}". Assess for immediate emergency services. Doctor ${patient.assignedDoctorName || patient.assignedDoctorId} also alerted.`);

        // Send a "System Alert" message to the doctor via chat system
        if (patient.assignedDoctorId) {
          const chatCollection = db.collection<RawPatientChatMessage>('chatMessages');
          const alertChatId = getChatId(patientIdStr, patient.assignedDoctorId);
          const alertMessage: Omit<RawPatientChatMessage, '_id'> = {
            chatId: alertChatId,
            senderId: patientIdStr, // System alerts will "originate" from the patient for routing to doctor
            senderName: 'System Alert', // Special sender name to identify alerts
            receiverId: patient.assignedDoctorId,
            text: `URGENT: Patient ${patient.displayName} reported SEVERE SYMPTOM: "${description}". Please review immediately.`,
            timestamp: new Date(),
            isRead: false,
          };
          await chatCollection.insertOne(alertMessage as RawPatientChatMessage);
          console.log(`PATIENT ACTION: System Alert message sent to doctor ${patient.assignedDoctorId} for patient ${patientIdStr}.`);
        }
      } else {
        console.error(`PATIENT ACTION: Could not find patient details for ${patientIdStr} to send severe symptom alerts.`);
      }
    }

    return { report: insertedReport };
  } catch (err: any) {
    console.error("Error submitting symptom report:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not save your report. " + (err.message || '') };
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
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not send message. " + (err.message || '') };
  }
}

// New action to fetch approved AI suggestions for a patient
export async function fetchPatientApprovedSuggestionsAction(patientIdStr: string): Promise<{
  suggestions?: PatientApprovedAISuggestion[],
  error?: string
}> {
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: "Invalid patient ID format." };
  }

  try {
    const { db } = await connectToDatabase();
    const suggestionsCollection = db.collection<RawPatientApprovedAISuggestion>('aiSuggestions');
    const rawSuggestions = await suggestionsCollection
      .find({ patientId: patientObjectId, status: 'approved' })
      .sort({ timestamp: -1 }) // Get newest first
      .limit(5) // Limit to latest 5, or adjust as needed
      .toArray();

    const suggestions: PatientApprovedAISuggestion[] = rawSuggestions.map(s => ({
      _id: s._id.toString(),
      id: s._id.toString(),
      patientId: s.patientId.toString(),
      suggestionText: s.suggestionText,
      timestamp: s.timestamp.toISOString(),
    }));

    return { suggestions };
  } catch (err: any) {
    console.error("Error fetching approved AI suggestions for patient:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
      return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not load approved suggestions. " + (err.message || '') };
  }
}
