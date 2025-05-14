
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

export async function fetchUnreadMessageCountAction(userId: string): Promise<{ count?: number; error?: string }> {
  if (!ObjectId.isValid(userId)) {
    // Non-ObjectId userIds might exist if coming from a different auth system or if generic strings are used.
    // For this app, userIds are ObjectIds from MongoDB.
    // return { error: 'Invalid user ID format for fetching unread messages.' };
    // Let's assume if it's not a valid ObjectId, it might be a string ID that is still valid in context
    // For now, proceed, but ideally, ensure consistent ID types.
  }
  try {
    const { db } = await connectToDatabase();
    const chatMessagesCollection = db.collection('chatMessages');
    
    // Count messages where the current user is the receiver and the message is unread
    const count = await chatMessagesCollection.countDocuments({
      receiverId: userId, // userId is expected to be a string here from the session
      isRead: false,
    });
    
    return { count };
  } catch (error: any) {
    console.error('Error fetching unread message count:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { error: 'Could not fetch unread message count. ' + (error.message || '') };
  }
}
