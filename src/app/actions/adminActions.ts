
'use server';

import { connectToDatabase, ObjectId, toObjectId } from '@/lib/mongodb';
import { sendWelcomeEmail } from '@/lib/email';
import { revalidatePath } from 'next/cache';

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
  medicalHistory?: string; // For patients
}

interface RawAdminUser {
  _id: ObjectId;
  displayName?: string | null;
  email?: string | null; // Contact email
  photoURL?: string | null;
  role?: 'patient' | 'doctor' | 'admin';
  lastSignInTime?: string | Date;
  creationTime?: string | Date;
  emergencyContactNumber?: string;
  emergencyContactEmail?: string;
  specialty?: string;
  assignedDoctorId?: string;
  medicalHistory?: string;
}


export async function fetchAdminDashboardData(): Promise<{ users?: AdminUser[], error?: string }> {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawAdminUser>('users');
    const userList = await usersCollection.find({}).toArray();
    
    const usersWithStringIds: AdminUser[] = userList.map(u => ({
      ...u,
      _id: u._id.toString(),
      id: u._id.toString(),
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
  const loginEmail = formData.get('loginEmail') as string; // This will be the login email
  const contactEmail = formData.get('contactEmail') as string | undefined; // Optional contact email
  const role = formData.get('role') as 'patient' | 'doctor' | 'admin';
  
  // Optional fields based on role
  const specialty = formData.get('specialty') as string | undefined; // For doctors
  const assignedDoctorId = formData.get('assignedDoctorId') as string | undefined; // For patients
  const medicalHistory = formData.get('medicalHistory') as string | undefined; // For patients
  const emergencyContactNumber = formData.get('emergencyContactNumber') as string | undefined; // For patients
  const emergencyContactEmail = formData.get('emergencyContactEmail') as string | undefined; // For patients


  if (!displayName || !loginEmail || !role) {
    return { success: false, message: 'Display Name, Login Email, and Role are required.' };
  }
  // Basic email validation (more robust validation on client or with Zod later)
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

    // Check if login email already exists in credentials
    const existingCredential = await credentialsCollection.findOne({ email: loginEmail });
    if (existingCredential) {
      return { success: false, message: 'This login email address is already in use.' };
    }

    const newUserObjectId = new ObjectId();
    const creationTime = new Date();

    const newUserDocument: Omit<RawAdminUser, '_id' | 'lastSignInTime'> & { creationTime: Date, lastSignInTime?: Date } = {
      displayName,
      email: contactEmail || loginEmail, // Use contactEmail if provided, else default to loginEmail for user profile
      role,
      photoURL: `https://placehold.co/100x100.png?text=${displayName.substring(0,2).toUpperCase()}`,
      creationTime,
      ...(role === 'doctor' && specialty && { specialty }),
      ...(role === 'patient' && assignedDoctorId && { assignedDoctorId }),
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
      email: loginEmail, // Login email
      passwordPlainText: temporaryPassword,
      requiresPasswordChange: true, // Set flag for first-time password change
    };

    await credentialsCollection.insertOne(newCredentialDocument);

    // Send welcome email
    const emailResult = await sendWelcomeEmail(loginEmail, displayName, temporaryPassword, role);
    if (!emailResult.success) {
      console.warn(`User created, but failed to send welcome email to ${loginEmail}: ${emailResult.error}`);
    }
    
    const createdUserForAdmin: AdminUser = {
      _id: newUserObjectId.toString(),
      id: newUserObjectId.toString(),
      displayName,
      email: newUserDocument.email, // contact email
      loginEmail: loginEmail, // login email
      role,
      photoURL: newUserDocument.photoURL,
      creationTime: creationTime.toISOString(),
      emergencyContactNumber: newUserDocument.emergencyContactNumber,
      emergencyContactEmail: newUserDocument.emergencyContactEmail,
      specialty: newUserDocument.specialty,
      assignedDoctorId: newUserDocument.assignedDoctorId,
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

    // Check if user is an admin to prevent self-deletion or deletion of other admins by non-superadmin (future concept)
    // For now, any admin can delete any other user.
    // const userToDelete = await usersCollection.findOne({ _id: userObjectId });
    // if (userToDelete && userToDelete.role === 'admin') {
    //   // Add logic here if you want to prevent admins from deleting other admins
    //   // or themselves without special confirmation.
    // }


    const userDeleteResult = await usersCollection.deleteOne({ _id: userObjectId });
    if (userDeleteResult.deletedCount === 0) {
      return { success: false, message: "User not found or already deleted from profiles." };
    }

    // Also delete from credentials
    const credentialDeleteResult = await credentialsCollection.deleteMany({ userId: userObjectId });
    // It's okay if no credentials found, maybe they were already cleaned up or never fully created.

    console.log(`User ${userId} and ${credentialDeleteResult.deletedCount} associated credentials deleted.`);
    
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
