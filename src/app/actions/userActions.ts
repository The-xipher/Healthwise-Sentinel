
'use server';
import { connectToDatabase, ObjectId } from '@/lib/mongodb';

// Define a more comprehensive user profile type for the profile page
export interface UserProfileData {
  _id: string;
  id: string;
  displayName: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  photoURL?: string | null;
  creationTime?: string | Date; // Keep as string for serializability if Date object from DB
  lastSignInTime?: string | Date; // Keep as string for serializability
  // Patient specific
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  medicalHistory?: string;
  readmissionRisk?: 'low' | 'medium' | 'high';
  // Doctor specific
  specialty?: string;
}

// Raw user type from DB, _id is ObjectId, dates are Date
interface RawUserProfile {
    _id: ObjectId;
    displayName: string;
    email: string;
    role: 'patient' | 'doctor' | 'admin';
    photoURL?: string | null;
    creationTime?: Date;
    lastSignInTime?: Date;
    assignedDoctorId?: string;
    assignedDoctorName?: string;
    medicalHistory?: string;
    readmissionRisk?: 'low' | 'medium' | 'high';
    specialty?: string;
}


export async function fetchUserProfile(userId: string): Promise<{ profile?: UserProfileData; error?: string }> {
  if (!ObjectId.isValid(userId)) {
    return { error: 'Invalid user ID format.' };
  }
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawUserProfile>('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return { error: 'User not found.' };
    }

    const profile: UserProfileData = {
      ...user,
      _id: user._id.toString(),
      id: user._id.toString(),
      creationTime: user.creationTime?.toISOString(), // Convert Date to ISO string
      lastSignInTime: user.lastSignInTime?.toISOString(), // Convert Date to ISO string
    };
    return { profile };
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: 'Could not load user profile. ' + (error.message || '') };
  }
}
