import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';

// Your web app's Firebase configuration
// These values MUST be set in your .env file (or environment variables)
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

// Define required keys - we need these for basic functionality
const requiredConfigKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  // 'storageBucket', // Making storage bucket optional for basic auth/firestore
  // 'messagingSenderId', // Optional
  'appId',
];

// Define known placeholder values to detect if the user hasn't replaced them
const placeholderValues = [
    "YOUR_API_KEY_HERE",
    "YOUR_AUTH_DOMAIN_HERE",
    "YOUR_PROJECT_ID_HERE",
    "YOUR_STORAGE_BUCKET_HERE",
    "YOUR_MESSAGING_SENDER_ID_HERE",
    "YOUR_APP_ID_HERE",
    "YOUR_MEASUREMENT_ID_HERE",
    "[PLACEHOLDER]",
    "NEXT_PUBLIC_", // Check if value starts with NEXT_PUBLIC_ prefix itself
    "undefined", // Check if the string "undefined" was somehow set
    null,
    "", // Check for empty strings
];

const missingOrPlaceholderKeys = requiredConfigKeys.filter(key => {
    const value = firebaseConfig[key];
    // Check if the value is missing, undefined, null, empty string, or matches any placeholder
    return !value || placeholderValues.some(placeholder =>
        typeof value === 'string' && (value === placeholder || value.startsWith("NEXT_PUBLIC_") || value === "undefined")
    );
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
            console.log("Firebase App Initialized Successfully.");
        } else {
            app = getApp();
            console.log("Using existing Firebase App instance.");
        }

        // Initialize essential services (Auth, Firestore)
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase Auth and Firestore Initialized.");

        // Optional: Initialize Functions if projectId seems valid
        if (firebaseConfig.projectId && !placeholderValues.includes(firebaseConfig.projectId)) {
           try {
               functions = getFunctions(app); // Default region or specify if needed: getFunctions(app, 'your-region')
                console.log("Firebase Functions Initialized.");
           } catch (e: any) {
                console.warn("Could not initialize Firebase Functions (this might be normal if not used or region not configured):", e.message);
           }
        } else {
             console.log("Firebase Functions skipped (invalid projectId).");
        }

        // Optional: Initialize Storage if storageBucket seems valid
        if (firebaseConfig.storageBucket && !placeholderValues.includes(firebaseConfig.storageBucket)) {
            storage = getStorage(app);
             console.log("Firebase Storage Initialized.");
        } else {
             console.log("Firebase Storage skipped (invalid storageBucket).");
        }

        // Optional: Initialize messaging only in the browser environment and if configured
        if (typeof window !== 'undefined' && firebaseConfig.messagingSenderId && !placeholderValues.includes(firebaseConfig.messagingSenderId)) {
            try {
                messaging = getMessaging(app);
                 console.log("Firebase Messaging Initialized.");
            } catch (error: any) {
                console.warn("Firebase Messaging could not be initialized (this might be normal if not configured, not supported, or in SSR):", error.message);
            }
        } else if (typeof window !== 'undefined') {
            console.log("Firebase Messaging skipped (invalid messagingSenderId or not in browser).");
        }

    } catch (error: any) {
        isFirebaseConfigValid = false; // Mark as invalid if initialization fails during runtime
        configErrorMessage = `🔴 FATAL: Failed to initialize Firebase services: ${error?.message || error}`;
        console.error(configErrorMessage);
        // Provide a more specific message for common errors like invalid API key
        if (error.code === 'auth/invalid-api-key' || error.message?.includes('invalid-api-key')) {
            console.error("Firebase Error Detail: Invalid API Key. Please ensure NEXT_PUBLIC_FIREBASE_API_KEY in your .env file is correct and the key is enabled in your Google Cloud Console / Firebase project.");
        } else if (error.code === 'auth/invalid-project-id' || error.message?.includes('invalid-project-id')) {
             console.error("Firebase Error Detail: Invalid Project ID. Please ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID in your .env file is correct.");
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
     // configErrorMessage should already be set and logged
     console.error("🔴 Firebase initialization skipped due to configuration errors detected before attempting to initialize.");
}

// Export potentially null services. Components using these MUST handle null cases.
export { app, auth, db, functions, storage, messaging };

// Helper function to check if Firebase was initialized successfully
export function isFirebaseInitialized(): boolean {
    // Check if config is valid AND the essential services (app, auth, db) were successfully initialized
    // It's crucial that app, auth, and db are not null.
    return isFirebaseConfigValid && !!app && !!auth && !!db;
}

// Export the error message for components to use if needed
export function getFirebaseConfigError(): string | null {
    // Return the specific error message if the configuration was invalid or initialization failed
    return isFirebaseConfigValid ? null : configErrorMessage;
}
