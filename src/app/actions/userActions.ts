
'use server';
import { connectToDatabase, ObjectId, toObjectId } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { isToday, parse, getHours, getMinutes, isPast } from 'date-fns'; // Added date-fns functions

// Define a more comprehensive user profile type for the profile page
export interface UserProfileData {
  _id: string;
  id: string;
  displayName: string;
  email: string; // This is the contact email from the 'users' collection
  loginEmail?: string; // This would be the login email from 'credentials' if needed on profile
  role: 'patient' | 'doctor' | 'admin';
  photoURL?: string | null;
  creationTime?: string | Date;
  lastSignInTime?: string | Date;
  emergencyContactNumber?: string;
  emergencyContactEmail?: string; // Added for emergency email alerts
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
    email: string; // Contact email
    role: 'patient' | 'doctor' | 'admin';
    photoURL?: string | null;
    creationTime?: Date;
    lastSignInTime?: Date;
    emergencyContactNumber?: string;
    emergencyContactEmail?: string; // Added
    assignedDoctorId?: string;
    assignedDoctorName?: string;
    medicalHistory?: string;
    readmissionRisk?: 'low' | 'medium' | 'high';
    specialty?: string;
}

export interface NotificationItem {
  id: string;
  type: 'chat' | 'alert' | 'medication_reminder'; // Added 'medication_reminder'
  title: string;
  description: string;
  timestamp: string;
  href: string;
  isRead?: boolean;
  isCritical?: boolean;
}

interface RawChatMessageForNotification {
  _id: ObjectId;
  senderId: string;
  senderName: string;
  receiverId: string; // Added to ensure we only fetch for the correct receiver
  text: string;
  timestamp: Date;
  chatId: string;
  isRead?: boolean;
}

interface RawMedicationForReminder {
    _id: ObjectId;
    patientId: ObjectId;
    name: string;
    lastTaken?: Date;
    reminderTimes?: string[]; // e.g., ["08:00 AM", "05:00 PM"]
}


export async function fetchUserProfile(userId: string): Promise<{ profile?: UserProfileData; error?: string, loginEmail?: string }> {
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

    // Optionally, fetch login email from credentials if needed for display
    const credentialsCollection = db.collection('credentials');
    const credential = await credentialsCollection.findOne({ userId: new ObjectId(userId) });
    const loginEmail = credential?.email;


    const profile: UserProfileData = {
      ...user,
      _id: user._id.toString(),
      id: user._id.toString(),
      creationTime: user.creationTime?.toISOString(),
      lastSignInTime: user.lastSignInTime?.toISOString(),
      emergencyContactNumber: user.emergencyContactNumber,
      emergencyContactEmail: user.emergencyContactEmail,
      loginEmail: loginEmail, // Add login email to profile data
    };
    return { profile, loginEmail };
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
    let notificationItems: NotificationItem[] = [];
    let totalUnreadCount = 0;

    // 1. Fetch unread chat messages and system alerts
    const unreadMessages = await chatMessagesCollection.find({
      receiverId: userId,
      isRead: { $ne: true },
    }).sort({ timestamp: -1 }).limit(10).toArray();

    totalUnreadCount = await chatMessagesCollection.countDocuments({
      receiverId: userId,
      isRead: { $ne: true },
    });

    const chatNotificationItems: NotificationItem[] = unreadMessages.map(msg => {
      let href = '/dashboard';
      let title = `Message from ${msg.senderName}`;
      let isCritical = false;
      let type: NotificationItem['type'] = 'chat';

      if (msg.senderName === 'System Alert' || msg.senderName === 'System Info') {
        title = msg.senderName === 'System Alert' ? `🚨 Urgent Alert: ${msg.text.substring(0,30)}...` : `ℹ️ System Info: ${msg.text.substring(0,30)}...`;
        isCritical = msg.senderName === 'System Alert';
        type = 'alert';
        if (userRole === 'doctor') {
           href = `/dashboard/doctor?patientId=${msg.senderId}`; // Assuming senderId is patientId for system alerts
        } else {
             href = `/dashboard/patient`; // For patient, system alerts are from their own actions/AI
        }
      } else {
        if (userRole === 'doctor') {
          href = `/dashboard/doctor?patientId=${msg.senderId}`;
        } else if (userRole === 'patient') {
          href = `/dashboard/patient`; // Patient chat notifications link to their dashboard's chat section
        }
      }

      return {
        id: msg._id.toString(),
        type: type,
        title: title,
        description: msg.text.length > 50 ? `${msg.text.substring(0, 47)}...` : msg.text,
        timestamp: msg.timestamp.toISOString(),
        href: href,
        isRead: false,
        isCritical: isCritical,
      };
    });
    notificationItems.push(...chatNotificationItems);

    // 2. Fetch medication reminders for patients
    if (userRole === 'patient') {
      const medicationsCollection = db.collection<RawMedicationForReminder>('medications');
      const patientObjectId = toObjectId(userId);
      if (patientObjectId) {
        const patientMedications = await medicationsCollection.find({ patientId: patientObjectId }).toArray();
        const now = new Date();

        patientMedications.forEach(med => {
          if (med.reminderTimes && med.reminderTimes.length > 0) {
            med.reminderTimes.forEach(timeStr => {
              // Parse time string like "08:00 AM" or "05:00 PM"
              const [time, period] = timeStr.split(' ');
              const [hoursStr, minutesStr] = time.split(':');
              let hours = parseInt(hoursStr, 10);
              const minutes = parseInt(minutesStr, 10);

              if (period && period.toUpperCase() === 'PM' && hours !== 12) {
                hours += 12;
              }
              if (period && period.toUpperCase() === 'AM' && hours === 12) { // Midnight case
                hours = 0;
              }

              if (!isNaN(hours) && !isNaN(minutes)) {
                const reminderDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
                const medicationTakenToday = med.lastTaken ? isToday(med.lastTaken) : false;

                if (isPast(reminderDateTime) && !medicationTakenToday) {
                  notificationItems.push({
                    id: `med-${med._id.toString()}-${timeStr.replace(/\s|:/g, '')}`, // Unique ID for reminder
                    type: 'medication_reminder',
                    title: `💊 Reminder: Take ${med.name}`,
                    description: `It's time for your ${timeStr} dose of ${med.name}.`,
                    timestamp: reminderDateTime.toISOString(), // Show reminder time
                    href: '/dashboard/patient', // Link to patient dashboard medication section
                    isRead: false, // These are transient, might not need read status or handle differently
                    isCritical: false, // Can be made critical if needed
                  });
                }
              }
            });
          }
        });
      }
    }

    // Sort all notifications: critical alerts first, then by timestamp descending
    notificationItems.sort((a, b) => {
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // The totalUnreadCount from chat messages is a good proxy for the badge,
    // or we can sum unread from all types if `isRead` is consistently used.
    // For now, using chat unread count for the badge.
    return { items: notificationItems.slice(0, 10), unreadCount: totalUnreadCount };

  } catch (error: any) {
    console.error('Error fetching notification items:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
        return { items: [], unreadCount: 0, error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { items: [], unreadCount: 0, error: 'Could not fetch notifications. ' + (error.message || '') };
  }
}


export interface UserProfileUpdateData {
  displayName?: string;
  // loginEmail?: string; // Login email typically not changed by user directly this way
  contactEmail?: string;
  emergencyContactNumber?: string;
  emergencyContactEmail?: string;
  photoURL?: string; // For future use if image upload is added
  // Role specific:
  specialty?: string; // For doctors
  medicalHistory?: string; // For patients
}


export async function updateUserProfileAction(
  userId: string,
  data: UserProfileUpdateData
): Promise<{ success: boolean; message: string; error?: string; updatedProfile?: UserProfileData }> {
  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    return { success: false, message: "Invalid user ID format." };
  }

  const updateData: Partial<RawUserProfile> = {};
  if (data.displayName) updateData.displayName = data.displayName;
  if (data.contactEmail) updateData.email = data.contactEmail; // User profile 'email' is contact email
  if (data.emergencyContactNumber !== undefined) updateData.emergencyContactNumber = data.emergencyContactNumber; // Allow empty string to clear
  if (data.emergencyContactEmail !== undefined) updateData.emergencyContactEmail = data.emergencyContactEmail; // Allow empty string to clear

  // Role specific fields - ensure they are only updated if relevant for the user's role (could add role check)
  if (data.specialty) updateData.specialty = data.specialty;
  if (data.medicalHistory) updateData.medicalHistory = data.medicalHistory;
  if (data.photoURL) updateData.photoURL = data.photoURL;


  if (Object.keys(updateData).length === 0) {
    return { success: false, message: "No changes provided." };
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<RawUserProfile>('users');

    const result = await usersCollection.findOneAndUpdate(
      { _id: userObjectId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) { // MongoDB 6.x findOneAndUpdate returns null if no doc found, older versions might differ
      return { success: false, message: "User not found or update failed." };
    }
    
    const updatedProfile = result as RawUserProfile; // Cast because 'value' is deprecated in newer driver versions for result
     if (!updatedProfile) {
       return { success: false, message: "Failed to retrieve updated profile." };
     }


    revalidatePath(`/dashboard/profile`);
    // Also revalidate specific dashboard paths if role-specific info changed, e.g. doctor specialty
    if (updateData.specialty && updatedProfile.role === 'doctor') revalidatePath(`/dashboard/doctor`);
    if ((updateData.medicalHistory || updateData.assignedDoctorId) && updatedProfile.role === 'patient') revalidatePath(`/dashboard/patient`);


    const displayProfile: UserProfileData = {
      ...updatedProfile,
      _id: updatedProfile._id.toString(),
      id: updatedProfile._id.toString(),
      creationTime: updatedProfile.creationTime?.toISOString(),
      lastSignInTime: updatedProfile.lastSignInTime?.toISOString(),
    };

    return { success: true, message: "Profile updated successfully.", updatedProfile: displayProfile };

  } catch (error: any) {
    console.error('Error updating user profile:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND')) {
      return { success: false, message: "Database connection timeout. Please check settings." };
    }
    return { success: false, message: 'An error occurred during profile update.', error: error.message || String(error) };
  }
}

