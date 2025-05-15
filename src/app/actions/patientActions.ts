
'use server';

import { connectToDatabase, toObjectId, ObjectId } from '@/lib/mongodb';
import { sendSevereSymptomAlertEmail } from '@/lib/email'; // Using the more specific function
import { analyzeSymptomSeverity, type AnalyzeSymptomSeverityInput, type AnalyzeSymptomSeverityOutput } from '@/ai/flows/analyzeSymptomSeverity'; // Import the new AI flow

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
  severity: 'mild' | 'moderate' | 'severe'; // This is patient-selected severity
  description: string;
  userId: string;
  // Optional: Fields for AI assessment if we decide to store them
  // aiDeterminedSeverity?: 'mild' | 'moderate' | 'severe';
  // aiJustification?: string;
  // aiRecommendedAlert?: boolean;
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
  timestamp: string; 
  isRead?: boolean;
}
interface RawPatientChatMessage { 
  _id: ObjectId;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: Date;
  isRead?: boolean;
}

interface PatientUserForAlerts { 
    _id: ObjectId;
    displayName: string;
    assignedDoctorId?: string;
    assignedDoctorName?: string; 
    emergencyContactNumber?: string;
    emergencyContactEmail?: string;
    medicalHistory?: string; 
    readmissionRisk?: 'low' | 'medium' | 'high'; 
}

export interface PatientApprovedAISuggestion {
  _id: string;
  id: string;
  patientId: string;
  suggestionText: string;
  timestamp: string; 
}

interface RawPatientApprovedAISuggestion {
  _id: ObjectId;
  patientId: ObjectId; 
  suggestionText: string;
  timestamp: Date;
  status: 'approved'; 
}


const getChatId = (id1: string, id2: string): string => {
  if (!id1 || !id2) return "";
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
      .limit(5) 
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
  manuallySelectedSeverity: 'mild' | 'moderate' | 'severe',
  description: string
): Promise<{ report?: PatientSymptomReport, error?: string, aiAssessment?: AnalyzeSymptomSeverityOutput }> {

  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: "Invalid patient ID format." };
  }

  const reportData: Omit<RawPatientSymptomReport, '_id'> = {
    patientId: patientObjectId,
    timestamp: new Date(),
    severity: manuallySelectedSeverity, // Store patient's selection
    description,
    userId: patientIdStr,
  };

  try {
    const { db } = await connectToDatabase();
    const symptomsCollection = db.collection<RawPatientSymptomReport>('symptomReports');
    const usersCollection = db.collection<PatientUserForAlerts>('users');
    const healthCollection = db.collection<RawPatientHealthData>('healthData');
    
    const result = await symptomsCollection.insertOne(reportData as RawPatientSymptomReport);
    const insertedReport: PatientSymptomReport = {
        ...reportData,
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
        patientId: reportData.patientId.toString(),
        timestamp: reportData.timestamp.toISOString()
    };

    // Fetch patient profile and latest vitals for AI analysis
    const patient = await usersCollection.findOne({ _id: patientObjectId });
    if (!patient) {
        console.error(`submitSymptomReportAction: Patient ${patientIdStr} not found for AI analysis.`);
        return { report: insertedReport, error: "Symptom reported, but patient details for AI analysis not found." };
    }

    const latestHealthData = await healthCollection.findOne(
        { patientId: patientObjectId },
        { sort: { timestamp: -1 } }
    );

    const patientRiskProfile = `Readmission Risk: ${patient.readmissionRisk || 'N/A'}. Medical History: ${patient.medicalHistory || 'No detailed history available.'}`;
    const latestVitalsSummary = latestHealthData ? 
        `Heart Rate: ${latestHealthData.heartRate ?? 'N/A'} bpm, Steps Today: ${latestHealthData.steps ?? 'N/A'}, Blood Glucose: ${latestHealthData.bloodGlucose ?? 'N/A'} mg/dL. Recorded at: ${latestHealthData.timestamp.toLocaleTimeString()}`
        : "No recent vitals available.";

    let aiAssessment: AnalyzeSymptomSeverityOutput | undefined;
    let triggerCriticalAlert = manuallySelectedSeverity === 'severe'; // Always alert if patient selects severe

    try {
        const aiInput: AnalyzeSymptomSeverityInput = {
            patientId: patientIdStr,
            symptomDescription: description,
            patientRiskProfile,
            latestVitals: latestVitalsSummary,
            manuallySelectedSeverity,
        };
        aiAssessment = await analyzeSymptomSeverity(aiInput);
        console.log(`AI Symptom Assessment for Patient ${patientIdStr}:`, JSON.stringify(aiAssessment, null, 2));

        if (aiAssessment.aiDeterminedSeverity === 'severe' || aiAssessment.isCriticalAlertRecommended) {
            triggerCriticalAlert = true;
        }
    } catch (aiError: any) {
        console.error(`AI symptom analysis failed for patient ${patientIdStr}:`, aiError);
        // If AI fails, we still rely on manual severity for alerting.
    }
    
    if (triggerCriticalAlert) {
        console.log(`PATIENT ACTION: CRITICAL ALERT TRIGGERED for ${patient.displayName} (ID: ${patientIdStr}) based on manual selection or AI assessment.`);
        
        let alertBaseDescription = `Patient ${patient.displayName} reported symptoms: "${description}". Patient-selected severity: ${manuallySelectedSeverity}.`;
        if (aiAssessment) {
            alertBaseDescription += `\nAI Assessment: Severity - ${aiAssessment.aiDeterminedSeverity}, Justification - ${aiAssessment.justification}, Critical Alert Recommended - ${aiAssessment.isCriticalAlertRecommended ? 'Yes' : 'No'}.`;
        } else {
            alertBaseDescription += `\nAI Assessment: Could not be performed or failed.`;
        }
        
        if (patient.emergencyContactNumber) {
          console.log(`PATIENT ACTION: SIMULATED URGENT SMS to ${patient.emergencyContactNumber}: ${alertBaseDescription} Please check on them.`);
        } else {
          console.log(`PATIENT ACTION: Patient ${patient.displayName} does not have an emergency contact number listed.`);
        }
        
        if (patient.emergencyContactEmail && patient.displayName) {
          const emailResult = await sendSevereSymptomAlertEmail(
            patient.emergencyContactEmail,
            patient.displayName,
            alertBaseDescription 
          );

          if (emailResult.success) {
            console.log(`PATIENT ACTION: Sent severe symptom alert email to ${patient.emergencyContactEmail}`);
          } else {
            console.warn(`PATIENT ACTION: Failed to send severe symptom alert email to ${patient.emergencyContactEmail}: ${emailResult.error}`);
          }
        } else {
            console.log(`PATIENT ACTION: Patient ${patient.displayName} does not have an emergency contact email listed for alerts.`);
        }

        console.error(`PATIENT ACTION: CRITICAL HEALTH ALERT LOG: ${alertBaseDescription}. Assess for immediate emergency services. Doctor ${patient.assignedDoctorName || patient.assignedDoctorId} also alerted.`);

        if (patient.assignedDoctorId) {
          const chatCollection = db.collection<RawPatientChatMessage>('chatMessages');
          const alertChatId = getChatId(patientIdStr, patient.assignedDoctorId);
          let doctorAlertMessage = `URGENT: Patient ${patient.displayName} reported: "${description}" (Patient severity: ${manuallySelectedSeverity}).`;
          if (aiAssessment) {
            doctorAlertMessage += `\nAI determined severity: ${aiAssessment.aiDeterminedSeverity}. Justification: ${aiAssessment.justification}.`;
            if (aiAssessment.isCriticalAlertRecommended) doctorAlertMessage += ` CRITICAL ALERT RECOMMENDED.`;
            if (aiAssessment.suggestedFollowUp) {
                if (aiAssessment.aiDeterminedSeverity === 'mild') {
                    doctorAlertMessage += `\nAI suggests patient be advised: "${aiAssessment.suggestedFollowUp}"`;
                } else if (aiAssessment.aiDeterminedSeverity === 'moderate') {
                     doctorAlertMessage += `\nAI suggests asking patient: "${aiAssessment.suggestedFollowUp}"`;
                }
            }
          } else {
             doctorAlertMessage += `\nAI assessment failed or was not performed.`;
          }
          doctorAlertMessage += `\nPlease review immediately.`;

          const alertMessage: Omit<RawPatientChatMessage, '_id'> = {
            chatId: alertChatId,
            senderId: patientIdStr, 
            senderName: 'System Alert', 
            receiverId: patient.assignedDoctorId,
            text: doctorAlertMessage,
            timestamp: new Date(),
            isRead: false,
          };
          await chatCollection.insertOne(alertMessage as RawPatientChatMessage);
          console.log(`PATIENT ACTION: System Alert message sent to doctor ${patient.assignedDoctorId} for patient ${patientIdStr}.`);
        }
    } else if (aiAssessment?.suggestedFollowUp) {
        // Handle non-critical follow-up suggestions (e.g., for mild/moderate cases without critical alert)
        if (patient.assignedDoctorId) {
            const chatCollection = db.collection<RawPatientChatMessage>('chatMessages');
            const alertChatId = getChatId(patientIdStr, patient.assignedDoctorId);
            let doctorInfoMessage = `INFO: Patient ${patient.displayName} reported: "${description}" (Patient severity: ${manuallySelectedSeverity}).`;
            doctorInfoMessage += `\nAI determined severity: ${aiAssessment.aiDeterminedSeverity}. Justification: ${aiAssessment.justification}.`;
            if (aiAssessment.aiDeterminedSeverity === 'mild') {
                doctorInfoMessage += `\nAI self-care tip suggested: "${aiAssessment.suggestedFollowUp}"`;
            } else if (aiAssessment.aiDeterminedSeverity === 'moderate') {
                doctorInfoMessage += `\nAI suggests asking patient: "${aiAssessment.suggestedFollowUp}"`;
            }
             doctorInfoMessage += `\nPlease review.`;

            const infoMessage: Omit<RawPatientChatMessage, '_id'> = {
                chatId: alertChatId,
                senderId: patientIdStr,
                senderName: 'System Info', // Differentiate from critical alerts
                receiverId: patient.assignedDoctorId,
                text: doctorInfoMessage,
                timestamp: new Date(),
                isRead: false,
            };
            await chatCollection.insertOne(infoMessage as RawPatientChatMessage);
            console.log(`PATIENT ACTION: System Info message sent to doctor ${patient.assignedDoctorId} for patient ${patientIdStr} with AI follow-up suggestion.`);
        }
    }


    return { report: insertedReport, aiAssessment };
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
      .sort({ timestamp: -1 }) 
      .limit(5) 
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
