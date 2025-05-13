
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import type { ObjectId } from 'mongodb';

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
