
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
// Auth import is removed: import { getAuth, type Auth } from 'firebase/auth';
// Firestore, Functions, Storage, Messaging imports are removed or commented if not immediately needed.

// Firebase configuration (retained in case other Firebase services are used later, like Storage)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check if Firebase is generally configured (e.g., for services other than Auth)
const isFirebaseConfigured =
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let app: FirebaseApp | null = null;
// auth variable is removed: let auth: Auth | null = null;
let firebaseConfigErrorMessage: string | null = null;

if (isFirebaseConfigured) {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      // Do NOT initialize auth here: auth = getAuth(app);
      console.log("Firebase App initialized successfully (core services, Auth is handled separately).");
    } catch (error) {
      console.error("Firebase App initialization error:", error);
      firebaseConfigErrorMessage = `Firebase App initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      app = null;
    }
  } else {
    app = getApps()[0];
    // Do NOT initialize auth here: auth = getAuth(app);
  }
} else {
  firebaseConfigErrorMessage = "Firebase core configuration is missing or invalid (apiKey, projectId). Update .env file if Firebase services (like Storage) are needed. Authentication is now handled by a custom system.";
  console.warn(firebaseConfigErrorMessage);
}

// Export only the app instance, auth is no longer managed here.
export { app };

// Helper function to check if Firebase core was initialized
export function isFirebaseCoreInitialized(): boolean {
  return isFirebaseConfigured && !!app;
}

export function getFirebaseConfigError(): string | null {
  return firebaseConfigErrorMessage;
}
