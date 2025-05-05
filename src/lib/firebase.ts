import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// --- Configuration Validation ---
let isFirebaseConfigValid = true;
let configErrorMessage = '';

const requiredConfigKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket', // Added storageBucket as often required
  'appId', // Added appId as generally required
];

const placeholderValues = [
    "YOUR_API_KEY_HERE",
    "YOUR_AUTH_DOMAIN_HERE",
    "YOUR_PROJECT_ID_HERE",
    "YOUR_STORAGE_BUCKET_HERE",
    "YOUR_MESSAGING_SENDER_ID_HERE",
    "YOUR_APP_ID_HERE",
    "YOUR_MEASUREMENT_ID_HERE",
    "[PLACEHOLDER]",
    "NEXT_PUBLIC_", // Check if value starts with NEXT_PUBLIC_ prefix
];

const missingOrPlaceholderKeys = requiredConfigKeys.filter(key => {
    const value = firebaseConfig[key];
    if (!value) return true; // Key is missing or empty
    // Check if value is one of the known placeholders or still the template value
    return placeholderValues.some(placeholder => typeof value === 'string' && (value === placeholder || value.startsWith(placeholder)));
});

if (missingOrPlaceholderKeys.length > 0) {
  isFirebaseConfigValid = false;
  configErrorMessage = `🔴 FATAL: Firebase configuration is invalid. Missing or placeholder values found for: ${missingOrPlaceholderKeys.join(', ')}. Please update your .env file with your actual Firebase project credentials. You can find these in your Firebase project settings under Project settings > General > Your apps > Web app > SDK setup and configuration > Config.`;
  console.error(configErrorMessage);
}
// --- End Configuration Validation ---


// Initialize Firebase services conditionally
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;

if (isFirebaseConfigValid) {
    try {
        // Initialize Firebase App
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
        }

        // Initialize other services
        auth = getAuth(app);
        db = getFirestore(app);
        // Optional: Initialize Functions and Storage if needed and configured
        if (firebaseConfig.projectId && !firebaseConfig.projectId.includes('YOUR_PROJECT_ID')) {
           try {
               functions = getFunctions(app);
           } catch (e) { console.warn("Could not initialize Firebase Functions (maybe region not set?):", e)}
        }
        if (firebaseConfig.storageBucket && !firebaseConfig.storageBucket.includes('YOUR_STORAGE_BUCKET')) {
            storage = getStorage(app);
        }

        // Initialize messaging only in the browser environment and if configured
        if (typeof window !== 'undefined' && firebaseConfig.messagingSenderId && !firebaseConfig.messagingSenderId.includes('YOUR_MESSAGING_SENDER_ID')) {
            try {
                messaging = getMessaging(app);
            } catch (error) {
                console.warn("Firebase Messaging could not be initialized (this might be normal if not configured, not supported, or in SSR):", error);
            }
        }
    } catch (error: any) {
        isFirebaseConfigValid = false; // Mark as invalid if initialization fails
        configErrorMessage = `🔴 FATAL: Failed to initialize Firebase services: ${error?.message || error}`;
        console.error(configErrorMessage);
        // Provide a more specific message for common errors like invalid API key
        if (error.code === 'auth/invalid-api-key' || error.message?.includes('invalid-api-key')) {
            console.error("Firebase Error Detail: Invalid API Key. Please ensure NEXT_PUBLIC_FIREBASE_API_KEY in your .env file is correct and the Firebase project/app is properly configured.");
        } else {
             console.error("Firebase Error Detail:", error.code, error.message);
        }
        // Reset services to null
        app = null;
        auth = null;
        db = null;
        functions = null;
        storage = null;
        messaging = null;
    }
} else {
     console.error("🔴 Firebase initialization skipped due to invalid or incomplete configuration.");
     // configErrorMessage should already be set
}

// Export potentially null services. Components using these should handle null cases.
export { app, auth, db, functions, storage, messaging };

// Helper function to check if Firebase was initialized successfully
export function isFirebaseInitialized(): boolean {
    // Check if config is valid AND the essential services (app, auth, db) were successfully initialized
    return isFirebaseConfigValid && !!app && !!auth && !!db;
}

// Export the error message for components to use if needed
export function getFirebaseConfigError(): string | null {
    return isFirebaseConfigValid ? null : configErrorMessage;
}
