import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';
import type { Messaging } from 'firebase/messaging';

// --- Firebase is explicitly NOT configured in this version ---
const isFirebaseConfigValid = false;
const configErrorMessage = "Firebase authentication is currently disabled. No configuration loaded.";

console.warn(configErrorMessage); // Log warning that Firebase is off

// Initialize Firebase services conditionally (they will remain null)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;

// Export null services. Components using these MUST handle null cases or be refactored.
export { app, auth, db, functions, storage, messaging };

// Helper function to check if Firebase was initialized successfully
export function isFirebaseInitialized(): boolean {
    // Firebase is explicitly disabled
    return false;
}

// Export the error message for components to use if needed
export function getFirebaseConfigError(): string | null {
    // Return the specific error message indicating Firebase is disabled
    return configErrorMessage;
}
