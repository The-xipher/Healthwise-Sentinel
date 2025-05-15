
'use server';

import { connectToDatabase, ObjectId, toObjectId } from '@/lib/mongodb';
import { sendWelcomeEmail, sendSevereSymptomAlertEmail } from '@/lib/email'; // Added sendSevereSymptomAlertEmail
import { revalidatePath } from 'next/cache';
import type { UserProfileData } from './userActions'; // For patient user type

export interface AdminUser {
  _id: string;
  id: string;
  displayName?: string | null;
  email?: string | null; // Contact email from users collection
  loginEmail?: string | null; // Login email from credentials (if needed, usually not shown directly)
  photoURL?: string | null;
  role?: 'patient' | 'doctor' | 'admin';
  lastSignInTime?: string | Date;
  creationTime?: string | Date;
  emergencyContactNumber?: string;
  emergencyContactEmail?: string;
  specialty?: string; // For doctors
  assignedDoctorId?: string; // For patients
  assignedDoctorName?: string; // For patients
  medicalHistory?: string; // For patients
}

interface RawAdminUser {
  _id: ObjectId;
  displayName?: string | null;
  email?: string | null; // Contact email
  photoURL?: string | null;
  role?: 'patient' | 'doctor' | 'admin';
  lastSignInTime?: string | Date;
  creationTime?: Date; // Changed to Date
  emergencyContactNumber?: string;
  emergencyContactEmail?: string;
  specialty?: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  medicalHistory?: string;
}

// Helper function to generate a unique chat ID
const getChatId = (id1: string, id2: string): string => {
  if (!id1 || !id2) return ""; // Handle cases where one ID might be missing
  return [id1, id2].sort().join('_');
};


export async function fetchAdminDashboardData(): Promise<{ users?: AdminUser[], error?: string }> {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawAdminUser>('users');
    const userList = await usersCollection.find({}).toArray();
    
    const usersWithStringIds: AdminUser[] = userList.map(u => ({
      ...u,
      _id: u._id.toString(),
      id: u._id.toString(),
      creationTime: u.creationTime?.toISOString(), // Convert Date to ISOString
    }));
    
    return { users: usersWithStringIds };
  } catch (err: any) {
    console.error("Error fetching users in server action:", err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: "Could not load user list from database. " + (err.message || '') };
  }
}

function generateTemporaryPassword(length: number = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

export async function createUserAction(
  formData: FormData
): Promise<{ success: boolean; message: string; error?: string; user?: AdminUser }> {
  const displayName = formData.get('displayName') as string;
  const loginEmail = formData.get('loginEmail') as string;
  const contactEmail = formData.get('contactEmail') as string | undefined;
  const role = formData.get('role') as 'patient' | 'doctor' | 'admin';
  
  const specialty = formData.get('specialty') as string | undefined;
  const assignedDoctorId = formData.get('assignedDoctorId') as string | undefined;
  const medicalHistory = formData.get('medicalHistory') as string | undefined;
  const emergencyContactNumber = formData.get('emergencyContactNumber') as string | undefined;
  const emergencyContactEmail = formData.get('emergencyContactEmail') as string | undefined;


  if (!displayName || !loginEmail || !role) {
    return { success: false, message: 'Display Name, Login Email, and Role are required.' };
  }
  if (!loginEmail.includes('@')) {
    return { success: false, message: 'Invalid login email format.' };
  }
  if (contactEmail && !contactEmail.includes('@')) {
    return { success: false, message: 'Invalid contact email format.' };
  }
  if (emergencyContactEmail && !emergencyContactEmail.includes('@')) {
     return { success: false, message: 'Invalid emergency contact email format.' };
  }

  const temporaryPassword = generateTemporaryPassword();

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const credentialsCollection = db.collection('credentials');

    const existingCredential = await credentialsCollection.findOne({ email: loginEmail });
    if (existingCredential) {
      return { success: false, message: 'This login email address is already in use.' };
    }

    const newUserObjectId = new ObjectId();
    const creationTime = new Date();
    
    let assignedDoctorName: string | undefined = undefined;
    if (role === 'patient' && assignedDoctorId) {
        const doctorProfile = await usersCollection.findOne({ _id: toObjectId(assignedDoctorId), role: 'doctor' });
        assignedDoctorName = doctorProfile?.displayName;
    }


    const newUserDocument: Omit<RawAdminUser, '_id' | 'lastSignInTime'> & { creationTime: Date, lastSignInTime?: Date } = {
      displayName,
      email: contactEmail || loginEmail,
      role,
      photoURL: `https://placehold.co/100x100.png?text=${displayName.substring(0,2).toUpperCase()}`,
      creationTime,
      ...(role === 'doctor' && specialty && { specialty }),
      ...(role === 'patient' && assignedDoctorId && { assignedDoctorId }),
      ...(role === 'patient' && assignedDoctorName && { assignedDoctorName }),
      ...(role === 'patient' && medicalHistory && { medicalHistory }),
      ...(role === 'patient' && emergencyContactNumber && { emergencyContactNumber }),
      ...(role === 'patient' && emergencyContactEmail && { emergencyContactEmail }),
    };
    
    const userInsertResult = await usersCollection.insertOne({ _id: newUserObjectId, ...newUserDocument });

    if (!userInsertResult.insertedId) {
      return { success: false, message: 'Failed to create user profile.' };
    }

    const newCredentialDocument = {
      _id: new ObjectId(),
      userId: newUserObjectId,
      email: loginEmail,
      passwordPlainText: temporaryPassword,
      requiresPasswordChange: true,
    };

    await credentialsCollection.insertOne(newCredentialDocument);

    const emailResult = await sendWelcomeEmail(loginEmail, displayName, temporaryPassword, role);
    if (!emailResult.success) {
      console.warn(`User created, but failed to send welcome email to ${loginEmail}: ${emailResult.error}`);
    }
    
    const createdUserForAdmin: AdminUser = {
      _id: newUserObjectId.toString(),
      id: newUserObjectId.toString(),
      displayName,
      email: newUserDocument.email,
      loginEmail: loginEmail,
      role,
      photoURL: newUserDocument.photoURL,
      creationTime: creationTime.toISOString(),
      emergencyContactNumber: newUserDocument.emergencyContactNumber,
      emergencyContactEmail: newUserDocument.emergencyContactEmail,
      specialty: newUserDocument.specialty,
      assignedDoctorId: newUserDocument.assignedDoctorId,
      assignedDoctorName: newUserDocument.assignedDoctorName,
      medicalHistory: newUserDocument.medicalHistory,
    };
    
    revalidatePath('/dashboard/admin');

    return { 
      success: true, 
      message: `User ${displayName} created successfully. A welcome email with temporary password has been sent to ${loginEmail}. They will be required to change their password on first login.`,
      user: createdUserForAdmin
    };

  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { success: false, message: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { success: false, message: 'An error occurred during user creation.', error: error.message || String(error) };
  }
}


export async function deleteUserAction(userId: string): Promise<{ success: boolean; message: string; error?: string }> {
  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    return { success: false, message: "Invalid user ID format." };
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const credentialsCollection = db.collection('credentials');

    const userDeleteResult = await usersCollection.deleteOne({ _id: userObjectId });
    if (userDeleteResult.deletedCount === 0) {
      return { success: false, message: "User not found or already deleted from profiles." };
    }

    const credentialDeleteResult = await credentialsCollection.deleteMany({ userId: userObjectId });
    
    revalidatePath('/dashboard/admin');

    return { success: true, message: `User (ID: ${userId}) and their credentials have been deleted successfully.` };

  } catch (error: any) {
    console.error('Error deleting user:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
      return { success: false, message: "Database connection timeout while trying to delete user." };
    }
    return { success: false, message: 'An error occurred during user deletion.', error: error.message || String(error) };
  }
}

export async function simulatePatientAlertAction(
  patientId: string,
  customAlertMessage?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const patientObjectId = toObjectId(patientId);
  if (!patientObjectId) {
    return { success: false, message: "Invalid patient ID format." };
  }

  const alertDescription = customAlertMessage || "Admin-simulated critical health alert for testing purposes.";

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawAdminUser>('users'); // Re-use RawAdminUser as it contains needed fields
    const patient = await usersCollection.findOne({ _id: patientObjectId, role: 'patient' });

    if (!patient) {
      return { success: false, message: "Patient not found or user is not a patient." };
    }

    let actionsTaken = [];

    // Simulate SMS to emergency contact number (Log)
    if (patient.emergencyContactNumber) {
      console.log(`ADMIN ACTION (SIMULATE ALERT): SIMULATED URGENT SMS to ${patient.emergencyContactNumber}: Patient ${patient.displayName} - ${alertDescription}. Please check on them.`);
      actionsTaken.push("Simulated SMS to emergency contact number.");
    } else {
      actionsTaken.push("No emergency contact number listed for patient to send SMS.");
    }

    // Send email to emergency contact email
    if (patient.emergencyContactEmail && patient.displayName) {
      const emailResult = await sendSevereSymptomAlertEmail(
        patient.emergencyContactEmail,
        patient.displayName,
        alertDescription
      );
      if (emailResult.success) {
        actionsTaken.push(`Emergency alert email sent to ${patient.emergencyContactEmail}.`);
      } else {
        actionsTaken.push(`Failed to send emergency alert email to ${patient.emergencyContactEmail}: ${emailResult.error}`);
        console.warn(`ADMIN ACTION (SIMULATE ALERT): Failed to send severe symptom alert email to ${patient.emergencyContactEmail}: ${emailResult.error}`);
      }
    } else {
      actionsTaken.push("No emergency contact email listed for patient, or patient display name missing.");
    }

    // Log for simulated emergency services call
    console.error(`ADMIN ACTION (SIMULATE ALERT): CRITICAL HEALTH ALERT: Patient ${patient.displayName} - ${alertDescription}. Assess for immediate emergency services. Doctor ${patient.assignedDoctorName || patient.assignedDoctorId} also alerted.`);
    actionsTaken.push("Logged critical alert for simulated emergency services call.");

    // Send "System Alert" message to the doctor via chat system
    if (patient.assignedDoctorId) {
      const chatCollection = db.collection('chatMessages'); // Assuming RawPatientChatMessage structure
      const alertChatId = getChatId(patientId, patient.assignedDoctorId);
      const alertMessage = {
        _id: new ObjectId(),
        chatId: alertChatId,
        senderId: patientId, // System alerts are from patient's perspective for doctor's view
        senderName: 'System Alert', 
        receiverId: patient.assignedDoctorId,
        text: `ADMIN SIMULATED ALERT: Patient ${patient.displayName} - ${alertDescription}. Please review immediately.`,
        timestamp: new Date(),
        isRead: false,
      };
      await chatCollection.insertOne(alertMessage);
      actionsTaken.push(`System Alert message sent to doctor ${patient.assignedDoctorName || patient.assignedDoctorId}.`);
      revalidatePath(`/dashboard/doctor`); // Revalidate doctor dashboard to show new chat/alert
      revalidatePath(`/dashboard/patient`);// Revalidate patient to update their chat if they view it
    } else {
      actionsTaken.push("Patient has no assigned doctor to notify via chat.");
    }
    
    revalidatePath(`/dashboard/admin`); // Revalidate admin dashboard

    return { 
      success: true, 
      message: `Alert simulation for ${patient.displayName} initiated. Actions taken: ${actionsTaken.join(' ')}`
    };

  } catch (error: any) {
    console.error('Error simulating patient alert:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
      return { success: false, message: "Database connection timeout during alert simulation." };
    }
    return { success: false, message: 'An error occurred during alert simulation.', error: error.message || String(error) };
  }
}
