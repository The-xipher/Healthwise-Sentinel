
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
  emergencyContactNumber?: string; // Added for patients
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
    emergencyContactNumber?: string; // Added for patients
    assignedDoctorId?: string;
    assignedDoctorName?: string;
    medicalHistory?: string;
    readmissionRisk?: 'low' | 'medium' | 'high';
    specialty?: string;
}

export interface NotificationItem {
  id: string; // message_id or alert_id
  type: 'chat' | 'alert';
  title: string; // e.g., "Message from John Doe" or "Severe Symptom Alert"
  description: string; // message snippet or alert details
  timestamp: string;
  href: string; // navigation link
  isRead?: boolean;
  isCritical?: boolean; // Added to flag critical alerts
}

interface RawChatMessageForNotification {
  _id: ObjectId;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  chatId: string; // To help determine context if needed
  // Potentially add a field to mark specific chat messages as alerts
  // isAlert?: boolean;
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
      emergencyContactNumber: user.emergencyContactNumber, // Ensure mapping
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

    // Fetch unread regular chat messages and system alerts (flagged by senderName === 'System Alert')
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
      let title = `Message from ${msg.senderName}`;
      let isCritical = false;

      if (msg.senderName === 'System Alert') { // Check if it's a system alert
        title = `🚨 Urgent: ${msg.text.substring(0,30)}...`; // Modify title for alerts
        isCritical = true;
        // For alerts, the doctor might want to go to the patient's detailed view.
        // Assuming the 'senderId' for system alerts is the patientId causing the alert.
        if (userRole === 'doctor') {
           href = `/dashboard/doctor?patientId=${msg.senderId}`; // senderId for SystemAlert is patientId
        } else {
            // Patients don't typically get "System Alerts" about themselves this way,
            // but if they did, it would go to their dashboard.
             href = `/dashboard/patient`;
        }
      } else { // Regular chat message
        if (userRole === 'doctor') {
          href = `/dashboard/doctor?patientId=${msg.senderId}`;
        } else if (userRole === 'patient') {
          href = `/dashboard/patient`;
        }
      }


      return {
        id: msg._id.toString(),
        type: isCritical ? 'alert' : 'chat',
        title: title,
        description: msg.text.length > 50 ? `${msg.text.substring(0, 47)}...` : msg.text,
        timestamp: msg.timestamp.toISOString(),
        href: href,
        isRead: false,
        isCritical: isCritical,
      };
    });

    // Sort by critical first, then by timestamp
    notificationItems.sort((a, b) => {
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
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
