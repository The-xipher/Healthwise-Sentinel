
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

export interface NotificationItem {
  id: string; // message_id or alert_id
  type: 'chat' | 'alert';
  title: string; // e.g., "Message from John Doe"
  description: string; // message snippet
  timestamp: string;
  href: string; // navigation link
  isRead?: boolean; 
}

interface RawChatMessageForNotification {
  _id: ObjectId;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  chatId: string; // To help determine context if needed
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
      creationTime: user.creationTime?.toISOString(), 
      lastSignInTime: user.lastSignInTime?.toISOString(), 
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

export async function fetchNotificationItemsAction(userId: string, userRole: UserProfileData['role']): Promise<{ items: NotificationItem[]; unreadCount: number; error?: string }> {
  try {
    const { db } = await connectToDatabase();
    const chatMessagesCollection = db.collection<RawChatMessageForNotification>('chatMessages');
    
    const unreadMessages = await chatMessagesCollection.find({
      receiverId: userId, 
      isRead: false,
    }).sort({ timestamp: -1 }).limit(10).toArray(); // Get latest 10 unread

    const totalUnreadCount = await chatMessagesCollection.countDocuments({
      receiverId: userId,
      isRead: false,
    });

    const notificationItems: NotificationItem[] = unreadMessages.map(msg => {
      let href = '/dashboard'; // Default
      if (userRole === 'doctor') {
        href = `/dashboard/doctor?patientId=${msg.senderId}`;
      } else if (userRole === 'patient') {
        href = `/dashboard/patient`; // Patient dashboard shows chat with their assigned doctor
      }
      // For admin, could be more complex if they chat with multiple types. Defaulting to /dashboard.

      return {
        id: msg._id.toString(),
        type: 'chat',
        title: `Message from ${msg.senderName}`,
        description: msg.text.length > 50 ? `${msg.text.substring(0, 47)}...` : msg.text,
        timestamp: msg.timestamp.toISOString(),
        href: href,
        isRead: false, // Since we fetched unread messages
      };
    });
    
    return { items: notificationItems, unreadCount: totalUnreadCount };
  } catch (error: any) {
    console.error('Error fetching notification items:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { items: [], unreadCount: 0, error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { items: [], unreadCount: 0, error: 'Could not fetch notifications. ' + (error.message || '') };
  }
}
