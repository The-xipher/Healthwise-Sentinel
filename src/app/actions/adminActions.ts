
'use server';

import { connectToDatabase, ObjectId } from '@/lib/mongodb';
import { sendWelcomeEmail } from '@/lib/email';
import { revalidatePath } from 'next/cache';

// Define the user type as expected by the AdminDashboard component
// Ensure this type matches the structure in AdminDashboard or import it if shareable
export interface AdminUser {
  _id: string; // Changed from ObjectId | string to string, as actions return JSON-serializable data
  id: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  role?: 'patient' | 'doctor' | 'admin';
  lastSignInTime?: string | Date;
  creationTime?: string | Date;
}

// Raw user type from DB before converting _id
interface RawAdminUser {
  _id: ObjectId;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  role?: 'patient' | 'doctor' | 'admin';
  lastSignInTime?: string | Date;
  creationTime?: string | Date;
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
  const email = formData.get('email') as string; // This will be the login email
  const role = formData.get('role') as 'patient' | 'doctor' | 'admin';
  
  // Optional fields based on role
  const specialty = formData.get('specialty') as string | undefined; // For doctors
  const assignedDoctorId = formData.get('assignedDoctorId') as string | undefined; // For patients
  const medicalHistory = formData.get('medicalHistory') as string | undefined; // For patients


  if (!displayName || !email || !role) {
    return { success: false, message: 'Display Name, Email, and Role are required.' };
  }
  if (role === 'doctor' && !specialty) {
    // return { success: false, message: 'Specialty is required for doctors.' };
    // Allowing specialty to be optional for now, can be enforced later
  }
  if (role === 'patient' && !assignedDoctorId) {
    // return { success: false, message: 'Assigned Doctor ID is required for patients.' };
     // Allowing assignedDoctorId to be optional for now
  }


  const temporaryPassword = generateTemporaryPassword();

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const credentialsCollection = db.collection('credentials');

    // Check if email already exists in credentials (login email)
    const existingCredential = await credentialsCollection.findOne({ email });
    if (existingCredential) {
      return { success: false, message: 'This login email address is already in use.' };
    }

    const newUserObjectId = new ObjectId();
    const creationTime = new Date();

    const newUserDocument: Omit<RawAdminUser, '_id' | 'lastSignInTime'> & { creationTime: Date, lastSignInTime?: Date } = {
      displayName,
      // The 'email' field in the users collection can be a contact email,
      // different from the login email if needed. For simplicity, let's make them same for now.
      email: email, 
      role,
      photoURL: `https://placehold.co/100x100.png?text=${displayName.substring(0,2).toUpperCase()}`,
      creationTime,
      ...(role === 'doctor' && specialty && { specialty }),
      ...(role === 'patient' && assignedDoctorId && { assignedDoctorId }),
      ...(role === 'patient' && medicalHistory && { medicalHistory }),
    };
    
    const userInsertResult = await usersCollection.insertOne({ _id: newUserObjectId, ...newUserDocument });

    if (!userInsertResult.insertedId) {
      return { success: false, message: 'Failed to create user profile.' };
    }

    const newCredentialDocument = {
      _id: new ObjectId(),
      userId: newUserObjectId,
      email: email, // Login email
      passwordPlainText: temporaryPassword, // Store plain text as per current app's mock nature
    };

    await credentialsCollection.insertOne(newCredentialDocument);

    // Send welcome email
    const emailResult = await sendWelcomeEmail(email, displayName, temporaryPassword, role);
    if (!emailResult.success) {
      console.warn(`User created, but failed to send welcome email to ${email}: ${emailResult.error}`);
      // Decide if this should be a partial success or full failure. For now, consider it a warning.
    }
    
    const createdUserForAdmin: AdminUser = {
      _id: newUserObjectId.toString(),
      id: newUserObjectId.toString(),
      displayName,
      email,
      role,
      photoURL: newUserDocument.photoURL,
      creationTime: creationTime.toISOString(),
    };
    
    revalidatePath('/dashboard/admin'); // To refresh the user list on the admin page

    return { 
      success: true, 
      message: `User ${displayName} created successfully. A welcome email with temporary password has been sent to ${email}.`,
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
