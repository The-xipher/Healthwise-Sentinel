
'use server';

import { cookies } from 'next/headers';
import { connectToDatabase, ObjectId } from '@/lib/mongodb';
// import { redirect } from 'next/navigation'; // Removed as redirect is now client-side

const SESSION_COOKIE_NAME = 'healthwise_session';

export interface UserSession { // Exporting for potential use elsewhere if needed
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

export async function loginAction(formData: FormData): Promise<{ success: boolean; message: string; role?: UserSession['role'] }> {
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
      return { success: false, message: 'User profile not found.' };
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

    // Return success and role, client will handle redirect
    return { success: true, message: 'Login successful. Redirecting...', role: userProfile.role };
    // redirect('/dashboard'); // Removed server-side redirect

  } catch (error: any) {
    // Errors thrown by redirect() are specific. Other errors are handled here.
    // If redirect() was in use and threw NEXT_REDIRECT, this block might have been skipped.
    // Now, any operational error in DB connection or query will be caught.
    console.error('Login error in action:', error);
    return { success: false, message: 'An error occurred during login. ' + (error.message || 'Unknown error') };
  }
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE_NAME);
  // This action is primarily called by the API route which handles the redirect.
  // If called directly (not typical for logout), a redirect here might be needed,
  // but standard practice is for the caller (form/API route) to handle navigation.
  // For safety, if Next.js changes behavior and this is somehow called directly AND expected to redirect:
  // import { redirect } from 'next/navigation';
  // redirect('/login'); 
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
