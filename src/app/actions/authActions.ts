
'use server';

import { cookies } from 'next/headers';
import { connectToDatabase, ObjectId } from '@/lib/mongodb';
import { redirect } from 'next/navigation';

const SESSION_COOKIE_NAME = 'healthwise_session';

export interface UserSession {
  userId: string;
  role: 'patient' | 'doctor' | 'admin';
  displayName: string;
  email: string; // Login email
  requiresPasswordChange?: boolean; // Added for forced password change
}

interface UserProfile {
  _id: ObjectId;
  displayName: string;
  role: 'patient' | 'doctor' | 'admin';
  email: string; // Contact email from users collection
}

interface Credential {
  _id: ObjectId;
  userId: ObjectId;
  email: string; // Login email
  passwordPlainText: string; 
  requiresPasswordChange?: boolean; // Added
}

export async function loginAction(formData: FormData): Promise<{ success: boolean; message: string; }> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' };
  }

  try {
    const { db } = await connectToDatabase();
    const credentialsCollection = db.collection<Credential>('credentials');
    const credential = await credentialsCollection.findOne({ email });

    if (!credential) {
      return { success: false, message: 'Invalid email or password.' };
    }

    if (credential.passwordPlainText !== password) {
      return { success: false, message: 'Invalid email or password.' };
    }

    const usersCollection = db.collection<UserProfile>('users');
    const userProfile = await usersCollection.findOne({ _id: new ObjectId(credential.userId) });

    if (!userProfile) {
      return { success: false, message: 'User profile not found for the provided credentials.' };
    }

    const sessionData: UserSession = {
      userId: userProfile._id.toString(),
      role: userProfile.role,
      displayName: userProfile.displayName,
      email: credential.email, // Use login email for session
      requiresPasswordChange: credential.requiresPasswordChange || false,
    };

    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
      sameSite: 'lax',
    });

    // // TODO: Implement forced password change logic here
    // if (sessionData.requiresPasswordChange) {
    //   redirect('/auth/change-password'); // Implement this page and logic
    // }

    redirect('/dashboard'); 

  } catch (error: any) {
    if (error.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Login error in action:', error);
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND') || error.message.includes('connect ETIMEDOUT')) {
        return { success: false, message: "Database connection timeout. Please check your network and MongoDB Atlas settings."};
    }
    return { success: false, message: 'An error occurred during login. ' + (error.message || 'Unknown error') };
  }
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE_NAME);
  redirect('/login'); 
}

export async function getSession(): Promise<UserSession | null> {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    return null;
  }
  try {
    return JSON.parse(sessionCookie.value) as UserSession;
  } catch (error) {
    console.error('Error parsing session cookie:', error);
    return null;
  }
}

// TODO: Add changePasswordAction here later for forced password change
// export async function changePasswordAction(userId: string, newPassword: string): Promise<{success: boolean, message: string}> { ... }
