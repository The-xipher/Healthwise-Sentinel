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

// Validate essential Firebase config variables
const requiredConfigKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
];

let isFirebaseConfigValid = true;
const missingOrPlaceholderKeys = requiredConfigKeys.filter(key => {
    const value = firebaseConfig[key];
    return !value || value.startsWith('YOUR_') || value.startsWith('NEXT_PUBLIC_') || value === '[PLACEHOLDER]';
});

if (missingOrPlaceholderKeys.length > 0) {
  console.error(`🔴 FATAL: Firebase configuration is missing or uses placeholder values in your .env file. Missing or placeholder keys: ${missingOrPlaceholderKeys.join(', ')}. Please update your environment variables with your actual Firebase project credentials.`);
  isFirebaseConfigValid = false;
  // In a real application, you might throw an error here or prevent the app from fully loading.
  // For this environment, we'll log the error and attempt to continue, but services will likely fail.
}

// Initialize Firebase services
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;

if (isFirebaseConfigValid) {
    try {
        if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        } else {
        app = getApp();
        }

        auth = getAuth(app);
        db = getFirestore(app);
        functions = getFunctions(app);
        storage = getStorage(app);

        // Initialize messaging only in the browser environment and if configured
        if (typeof window !== 'undefined' && firebaseConfig.messagingSenderId && !firebaseConfig.messagingSenderId.startsWith('YOUR_')) {
            try {
                messaging = getMessaging(app);
            } catch (error) {
                console.warn("Firebase Messaging could not be initialized (this might be normal if not configured or in SSR):", error);
                // Handle cases where messaging is not supported
            }
        }
    } catch (error: any) {
        console.error("🔴 FATAL: Failed to initialize Firebase services:", error);
        // Provide a more specific message for common errors
        if (error.code === 'auth/invalid-api-key' || error.message?.includes('invalid-api-key')) {
            console.error("Firebase Error Detail: Invalid API Key. Please ensure NEXT_PUBLIC_FIREBASE_API_KEY in your environment variables is correct and the Firebase project is properly configured.");
        } else {
             console.error("Firebase Error Detail:", error.code, error.message);
        }
        // Set services to null to prevent downstream errors in components trying to use them.
        app = null;
        auth = null;
        db = null;
        functions = null;
        storage = null;
        messaging = null;

        // Optionally re-throw or throw a custom error to stop app execution if Firebase is critical
        // throw new Error("Firebase initialization failed. Please check your configuration and console logs.");
    }
} else {
     console.error("🔴 Firebase initialization skipped due to invalid configuration.");
}

// Export potentially null services. Components using these should handle null cases.
export { app, auth, db, functions, storage, messaging };

// Helper function to check if Firebase was initialized successfully
export function isFirebaseInitialized(): boolean {
    return !!app && !!auth && !!db;
}
