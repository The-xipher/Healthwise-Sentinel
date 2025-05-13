
'use server';

import { connectToDatabase, toObjectId } from '@/lib/mongodb';
import type { ObjectId } from 'mongodb';

export interface PatientHealthData {
  _id: string;
  id: string;
  patientId: string;
  timestamp: string; // Dates should be stringified for client
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number;
}
interface RawPatientHealthData { // DB representation
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
  lastTaken?: string; // Dates should be stringified
  adherence?: number;
}
interface RawPatientMedication { // DB representation
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
  timestamp: string; // Dates should be stringified
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  userId: string; 
}
interface RawPatientSymptomReport { // DB representation
  _id: ObjectId;
  patientId: ObjectId;
  timestamp: Date;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  userId: string; 
}


export async function fetchPatientDashboardDataAction(patientIdStr: string): Promise<{
  healthData?: PatientHealthData[],
  medications?: PatientMedication[],
  symptomReports?: PatientSymptomReport[],
  error?: string
}> {
  const patientObjectId = toObjectId(patientIdStr);
  if (!patientObjectId) {
    return { error: "Invalid patient ID format." };
  }

  try {
    const { db } = await connectToDatabase();

    const healthCollection = db.collection<RawPatientHealthData>('healthData');
    const rawHealthData = await healthCollection.find({ patientId: patientObjectId })
      .sort({ timestamp: -1 }).limit(30).toArray();
    // Reverse for chronological chart on client
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
      adherence: med.adherence ?? Math.floor(Math.random() * 41) + 60 // Keep existing simulation
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

    return { healthData, medications, symptomReports };
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
    userId: patientIdStr, // Using patientIdStr as userId for simplicity as in original component
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
