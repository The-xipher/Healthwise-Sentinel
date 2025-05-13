
'use server';

import { cookies } from 'next/headers';
import { connectToDatabase, ObjectId } from '@/lib/mongodb';
import { redirect } from 'next/navigation';

const SESSION_COOKIE_NAME = 'healthwise_session';

export interface UserSession {
  userId: string;
  role: 'patient' | 'doctor' | 'admin';
  displayName: string;
  email: string;
}

// This is a simplified User type from DB user collection. Adjust as needed.
interface UserProfile {
  _id: ObjectId;
  displayName: string;
  role: 'patient' | 'doctor' | 'admin';
  email: string;
  // other fields if necessary for the session
}

interface Credential {
  _id: ObjectId;
  userId: ObjectId;
  email: string;
  passwordPlainText: string; // In a real app, this would be a hashed password
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

    // IMPORTANT: This is plain text password comparison, ONLY for mock/demo purposes.
    // In a real application, use bcrypt or a similar library to compare hashed passwords.
    if (credential.passwordPlainText !== password) {
      return { success: false, message: 'Invalid email or password.' };
    }

    const usersCollection = db.collection<UserProfile>('users');
    const userProfile = await usersCollection.findOne({ _id: new ObjectId(credential.userId) });

    if (!userProfile) {
      // This case should ideally not happen if DB is consistent
      return { success: false, message: 'User profile not found for the provided credentials.' };
    }

    const sessionData: UserSession = {
      userId: userProfile._id.toString(),
      role: userProfile.role,
      displayName: userProfile.displayName,
      email: userProfile.email,
    };

    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
      sameSite: 'lax',
    });

    // Server-side redirect to the generic dashboard page.
    // /dashboard page will then handle role-specific redirection.
    redirect('/dashboard'); 
    // Note: redirect() throws a NEXT_REDIRECT error, so code below it won't execute.
    // The function signature implies a return, but redirecting makes it effectively not return a value in the success path.
    // For error paths, it still returns.

  } catch (error: any) {
    // If error is NEXT_REDIRECT, rethrow it to let Next.js handle it.
    if (error.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Login error in action:', error);
    // Handle specific MongoDB connection errors if necessary
    if (error.message.includes('queryTxt ETIMEOUT') || error.message.includes('querySrv ENOTFOUND') || error.message.includes('connect ETIMEDOUT')) {
        return { success: false, message: "Database connection timeout. Please check your network and MongoDB Atlas settings."};
    }
    return { success: false, message: 'An error occurred during login. ' + (error.message || 'Unknown error') };
  }
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE_NAME);
  // This action is primarily called by the API route which handles the redirect.
  // If called directly (not typical for logout), a redirect here might be needed,
  // but standard practice is for the caller (form/API route) to handle navigation.
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
    // Optionally delete the malformed cookie
    // cookies().delete(SESSION_COOKIE_NAME);
    return null;
  }
}
