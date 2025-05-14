
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import type { ObjectId }
from 'mongodb';

export interface ChatMessage {
  _id: string;
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: string; 
  isRead?: boolean;
}

interface RawChatMessage {
  _id: ObjectId;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: Date;
  isRead?: boolean;
}

export async function markMessagesAsReadAction(
  chatId: string,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!chatId || !currentUserId) {
    return { success: false, error: 'Chat ID and User ID are required to mark messages as read.' };
  }

  try {
    const { db } = await connectToDatabase();
    const chatCollection = db.collection<RawChatMessage>('chatMessages');

    const result = await chatCollection.updateMany(
      {
        chatId: chatId,
        receiverId: currentUserId, // Only mark messages where the current user is the receiver
        isRead: false,             // Only update unread messages
      },
      { $set: { isRead: true } }
    );
    
    // console.log(`Marked ${result.modifiedCount} messages as read for user ${currentUserId} in chat ${chatId}`);
    return { success: true };
  } catch (err: any) {
    console.error('Error marking messages as read:', err);
    if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('querySrv ENOTFOUND')) {
        return { success: false, error: "Database connection timeout. Please check your network and MongoDB Atlas settings." };
    }
    return { success: false, error: 'Could not update message status. ' + (err.message || '') };
  }
}
