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

const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key] || firebaseConfig[key] === `YOUR_${key.toUpperCase().replace('FIREBASE_', '')}`);

if (missingKeys.length > 0) {
  console.error(`Firebase configuration is missing or incomplete in your .env file. Missing or placeholder keys: ${missingKeys.join(', ')}. Please update .env with your actual Firebase project credentials.`);
  // You might want to throw an error here or handle it differently
  // depending on whether the app can function without Firebase.
  // throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`);
}

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let storage: FirebaseStorage;
let messaging: Messaging | null = null;

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

    // Initialize messaging only in the browser environment
    if (typeof window !== 'undefined' && firebaseConfig.messagingSenderId && firebaseConfig.messagingSenderId !== 'YOUR_MESSAGING_SENDER_ID') {
        try {
            messaging = getMessaging(app);
        } catch (error) {
            console.warn("Firebase Messaging could not be initialized (this might be normal if not configured or in SSR):", error);
            // Handle cases where messaging is not supported (e.g., missing VAPID key, service worker issues)
        }
    }
} catch (error: any) {
    console.error("Failed to initialize Firebase:", error);
    // Provide a more specific message for common errors
    if (error.code === 'auth/invalid-api-key') {
         console.error("Firebase Error: Invalid API Key. Please check NEXT_PUBLIC_FIREBASE_API_KEY in your .env file.");
    }
     // Set services to null or handle the error appropriately
     // to prevent downstream errors in components trying to use them.
     // For now, we let the error propagate, but you might want a fallback.
     app = null!; // Using null assertion, handle potential nulls where used if needed
     auth = null!;
     db = null!;
     functions = null!;
     storage = null!;
     messaging = null;

     // Optionally re-throw or throw a custom error to stop app execution if Firebase is critical
     // throw new Error("Firebase initialization failed. Please check your configuration and console logs.");
}


export { app, auth, db, functions, storage, messaging };
