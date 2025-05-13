import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
// Firestore, Functions, Storage, Messaging imports are removed as primary focus shifts or they are not used.

// Firebase configuration (primarily for Auth if used)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // Optional: if using Firebase Storage
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, // Optional: if using Firebase Messaging
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Check if the Firebase Auth configuration is valid (API key and Auth Domain are minimal requirements for Auth)
const isFirebaseAuthEnabled =
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.authDomain && firebaseConfig.authDomain !== "YOUR_AUTH_DOMAIN" &&
  firebaseConfig.projectId; // Project ID is generally good to have for a functional app.

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
// db (Firestore), functions, storage, messaging variables are removed.
let firebaseConfigErrorMessage: string | null = null;

if (isFirebaseAuthEnabled) {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      console.log("Firebase App (for Auth, if configured) initialized successfully.");
      // Initialize other Firebase services like Storage or Messaging here if needed and configured
    } catch (error) {
      console.error("Firebase App initialization error:", error);
      firebaseConfigErrorMessage = `Firebase App (for Auth) initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      app = null;
      auth = null;
    }
  } else {
    app = getApps()[0];
    auth = getAuth(app);
  }
} else {
  firebaseConfigErrorMessage = "Firebase Auth is not configured or configuration is invalid. Placeholder values found for: apiKey, authDomain, or projectId. Update .env file if Firebase Auth is needed.";
  console.warn(firebaseConfigErrorMessage);
}

// Export the services (they might be null if config is invalid or not provided)
export { app, auth }; // Only exporting app and auth

// Helper function to check if Firebase Auth was intended to be initialized and succeeded
export function isFirebaseAuthInitialized(): boolean {
  return isFirebaseAuthEnabled && !!app && !!auth;
}

// Export the error message for components to use if needed
export function getFirebaseConfigError(): string | null {
  return firebaseConfigErrorMessage;
}
