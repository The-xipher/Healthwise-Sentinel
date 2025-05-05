import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getMessaging, type Messaging } from 'firebase/messaging';

// IMPORTANT: This configuration is currently set up to be DISABLED by default.
// To enable Firebase features (including seeding), you MUST provide valid
// Firebase configuration values in your environment (e.g., a .env.local file).
// Find these in your Firebase project settings:
// Project settings > General > Your apps > Web app > SDK setup and configuration > Config.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Check if the configuration is valid (all required keys have values)
// Note: We treat empty strings as invalid here as well.
const isFirebaseConfigValid =
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.authDomain && firebaseConfig.authDomain !== "YOUR_AUTH_DOMAIN" &&
  firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
  firebaseConfig.storageBucket && firebaseConfig.storageBucket !== "YOUR_STORAGE_BUCKET" &&
  firebaseConfig.appId && firebaseConfig.appId !== "YOUR_APP_ID";


let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;
let configErrorMessage: string | null = null;

if (isFirebaseConfigValid) {
  // Initialize Firebase only if config is valid and no apps are initialized yet
  if (!getApps().length) {
      try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        functions = getFunctions(app); // Optional: Initialize if needed
        storage = getStorage(app);     // Optional: Initialize if needed
        // messaging = getMessaging(app); // Optional: Initialize if needed
        console.log("Firebase initialized successfully.");
      } catch (error) {
         console.error("Firebase initialization error:", error);
         configErrorMessage = `Firebase initialization failed: ${error instanceof Error ? error.message : String(error)}`;
         // Ensure services are null if initialization fails
         app = null;
         auth = null;
         db = null;
         functions = null;
         storage = null;
         messaging = null;
      }
  } else {
    // It's already initialized, use existing instance
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app); // Optional
    storage = getStorage(app);     // Optional
    // messaging = getMessaging(app); // Optional
  }
} else {
  // Configuration is missing or invalid
  configErrorMessage = "FATAL: Firebase configuration is invalid. Missing or placeholder values found for: apiKey, authDomain, projectId, storageBucket, appId. Please update your .env file with your actual Firebase project credentials. You can find these in your Firebase project settings under Project settings > General > Your apps > Web app > SDK setup and configuration > Config.";
  console.error(configErrorMessage); // Log error
}


// Export the services (they might be null if config is invalid)
export { app, auth, db, functions, storage, messaging };

// Helper function to check if Firebase was intended to be initialized and succeeded
export function isFirebaseInitialized(): boolean {
    return isFirebaseConfigValid && !!app && !!db; // Check essential services like app and db
}

// Export the error message for components to use if needed
export function getFirebaseConfigError(): string | null {
    return configErrorMessage;
}
