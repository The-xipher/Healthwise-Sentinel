'use client';

import * as React from 'react';
import { faker } from '@faker-js/faker';
import { collection, writeBatch, doc, Timestamp, setDoc } from 'firebase/firestore';
import { db, isFirebaseInitialized, getFirebaseConfigError } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Placeholder IDs used in dashboards
const PLACEHOLDER_PATIENT_ID = 'test-patient-id';
const PLACEHOLDER_DOCTOR_ID = 'test-doctor-id';
const PLACEHOLDER_ADMIN_ID = 'test-admin-id';

// Type definitions (simplified for seeding)
interface MockUser {
    id: string;
    displayName: string;
    email: string;
    photoURL: string;
    role: 'patient' | 'doctor' | 'admin';
    assignedDoctorId?: string;
    medicalHistory?: string;
    readmissionRisk?: 'low' | 'medium' | 'high';
    creationTime?: string; // Store as ISO string
}

interface MockHealthData {
    timestamp: Timestamp;
    steps?: number;
    heartRate?: number;
    bloodGlucose?: number;
}

interface MockMedication {
    name: string;
    dosage: string;
    frequency: string;
    adherence?: number; // Optional
}

interface MockSymptomReport {
    timestamp: Timestamp;
    severity: 'mild' | 'moderate' | 'severe';
    description: string;
    userId: string; // The patient's ID
}

interface MockAiSuggestion {
    patientId: string;
    suggestionText: string;
    timestamp: Timestamp;
    status: 'pending' | 'approved' | 'rejected';
}

interface MockChatMessage {
    senderId: string;
    senderName: string;
    text: string;
    timestamp: Timestamp;
}

export default function SeedPage() {
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [firebaseError, setFirebaseError] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        // Set error state based on Firebase initialization status
        if (!isFirebaseInitialized()) {
            setFirebaseError(getFirebaseConfigError() || "Firebase is not available or configured correctly.");
        } else {
            setFirebaseError(null);
        }
    }, []);

    const seedDatabase = async () => {
        if (!isFirebaseInitialized() || !db) {
            toast({
                title: "Seeding Failed",
                description: firebaseError || "Firebase database is not available.",
                variant: "destructive",
            });
            return;
        }

        setIsSeeding(true);
        toast({ title: "Seeding Started", description: "Populating Firestore with mock data..." });

        try {
            const batch = writeBatch(db);

            // --- Create Mock Users ---
            const users: MockUser[] = [
                // The primary test patient
                {
                    id: PLACEHOLDER_PATIENT_ID,
                    displayName: faker.person.fullName(),
                    email: faker.internet.email(),
                    photoURL: faker.image.avatar(),
                    role: 'patient',
                    assignedDoctorId: PLACEHOLDER_DOCTOR_ID,
                    medicalHistory: `Diagnosed with ${faker.lorem.words(2)} in ${faker.date.past({ years: 5 }).getFullYear()}. Allergic to ${faker.lorem.word()}. Previous surgery: ${faker.lorem.words(3)} in ${faker.date.past({ years: 2 }).getFullYear()}.`,
                    readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high']),
                    creationTime: faker.date.past({ years: 1 }).toISOString(),
                },
                // The primary test doctor
                {
                    id: PLACEHOLDER_DOCTOR_ID,
                    displayName: `Dr. ${faker.person.lastName()}`,
                    email: faker.internet.email({ firstName: 'dr', lastName: faker.person.lastName().toLowerCase() }),
                    photoURL: faker.image.avatar(),
                    role: 'doctor',
                    creationTime: faker.date.past({ years: 3 }).toISOString(),
                },
                // The primary test admin
                {
                    id: PLACEHOLDER_ADMIN_ID,
                    displayName: `Admin ${faker.person.firstName()}`,
                    email: faker.internet.email({ firstName: 'admin', lastName: faker.company.name().split(' ')[0].toLowerCase() }),
                    photoURL: faker.image.avatar(),
                    role: 'admin',
                    creationTime: faker.date.past({ years: 2 }).toISOString(),
                },
                // Add a few more patients for the list
                ...Array.from({ length: 3 }).map(() => ({
                    id: faker.string.uuid(),
                    displayName: faker.person.fullName(),
                    email: faker.internet.email(),
                    photoURL: faker.image.avatar(),
                    role: 'patient' as const,
                    assignedDoctorId: PLACEHOLDER_DOCTOR_ID,
                    medicalHistory: `Diagnosed with ${faker.lorem.words(2)} in ${faker.date.past({ years: 5 }).getFullYear()}.`,
                    readmissionRisk: faker.helpers.arrayElement(['low', 'medium', 'high'] as const),
                    creationTime: faker.date.past({ years: 1 }).toISOString(),
                })),
                 // Add another doctor
                 {
                    id: faker.string.uuid(),
                    displayName: `Dr. ${faker.person.lastName()}`,
                    email: faker.internet.email({ firstName: 'dr', lastName: faker.person.lastName().toLowerCase() }),
                    photoURL: faker.image.avatar(),
                    role: 'doctor' as const,
                    creationTime: faker.date.past({ years: 2 }).toISOString(),
                },
            ];

            users.forEach(user => {
                const userRef = doc(db, 'users', user.id);
                batch.set(userRef, {
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    role: user.role,
                    ...(user.assignedDoctorId && { assignedDoctorId: user.assignedDoctorId }),
                    ...(user.medicalHistory && { medicalHistory: user.medicalHistory }),
                    ...(user.readmissionRisk && { readmissionRisk: user.readmissionRisk }),
                    ...(user.creationTime && { creationTime: user.creationTime }),
                });
            });


            // --- Create Mock Health Data for the main patient ---
            const healthDataCol = collection(db, `patients/${PLACEHOLDER_PATIENT_ID}/healthData`);
            for (let i = 0; i < 30; i++) {
                const healthData: MockHealthData = {
                    timestamp: Timestamp.fromDate(faker.date.recent({ days: 30 - i })),
                    steps: faker.number.int({ min: 1000, max: 12000 }),
                    heartRate: faker.number.int({ min: 60, max: 110 }),
                    bloodGlucose: faker.number.int({ min: 80, max: 160 }),
                };
                batch.set(doc(healthDataCol), healthData);
            }


            // --- Create Mock Medications for the main patient ---
            const medicationsCol = collection(db, `patients/${PLACEHOLDER_PATIENT_ID}/medications`);
            const meds: MockMedication[] = [
                { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', adherence: faker.number.int({ min: 75, max: 100 }) },
                { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', adherence: faker.number.int({ min: 60, max: 95 }) },
                { name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily', adherence: faker.number.int({ min: 80, max: 100 }) },
            ];
            meds.forEach(med => {
                 batch.set(doc(medicationsCol), {
                    name: med.name,
                    dosage: med.dosage,
                    frequency: med.frequency,
                    adherence: med.adherence,
                    lastTaken: Timestamp.fromDate(faker.date.recent({ days: 1 })), // Simulate recent intake
                 });
            });

            // --- Create Mock Symptom Reports for the main patient ---
            const symptomsCol = collection(db, `patients/${PLACEHOLDER_PATIENT_ID}/symptomReports`);
            for (let i = 0; i < 5; i++) {
                const report: MockSymptomReport = {
                    timestamp: Timestamp.fromDate(faker.date.recent({ days: 10 })),
                    severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe']),
                    description: faker.lorem.sentence(),
                    userId: PLACEHOLDER_PATIENT_ID,
                };
                batch.set(doc(symptomsCol), report);
            }

            // --- Create Mock AI Suggestions for the main patient ---
            const suggestionsCol = collection(db, `patients/${PLACEHOLDER_PATIENT_ID}/aiSuggestions`);
            const suggestions: MockAiSuggestion[] = [
                { patientId: PLACEHOLDER_PATIENT_ID, suggestionText: 'Consider adjusting Metformin dosage based on recent glucose readings.', timestamp: Timestamp.now(), status: 'pending' },
                { patientId: PLACEHOLDER_PATIENT_ID, suggestionText: 'Remind patient about importance of taking Atorvastatin consistently.', timestamp: Timestamp.fromDate(faker.date.recent({ days: 2 })), status: 'approved' },
                { patientId: PLACEHOLDER_PATIENT_ID, suggestionText: 'Recommend follow-up appointment to discuss reported dizziness.', timestamp: Timestamp.fromDate(faker.date.recent({ days: 5 })), status: 'pending' },
            ];
            suggestions.forEach(sug => {
                batch.set(doc(suggestionsCol), sug);
            });

             // --- Create Mock Chat Messages ---
            const chatId = [PLACEHOLDER_DOCTOR_ID, PLACEHOLDER_PATIENT_ID].sort().join('_');
            const chatCol = collection(db, `chats/${chatId}/messages`);
            const messages: MockChatMessage[] = [
                 { senderId: PLACEHOLDER_PATIENT_ID, senderName: users.find(u=>u.id === PLACEHOLDER_PATIENT_ID)?.displayName || 'Patient', text: 'Feeling a bit dizzy today.', timestamp: Timestamp.fromDate(faker.date.recent({ days: 1 })) },
                 { senderId: PLACEHOLDER_DOCTOR_ID, senderName: users.find(u=>u.id === PLACEHOLDER_DOCTOR_ID)?.displayName || 'Doctor', text: 'Thanks for letting me know. Please monitor your blood pressure and report back if it continues.', timestamp: Timestamp.now() },
                 { senderId: PLACEHOLDER_PATIENT_ID, senderName: users.find(u=>u.id === PLACEHOLDER_PATIENT_ID)?.displayName || 'Patient', text: 'Will do, thank you Doctor.', timestamp: Timestamp.now() },
            ];
            messages.forEach(msg => {
                batch.set(doc(chatCol), msg);
            });

            // Commit the batch
            await batch.commit();

            toast({
                title: "Seeding Complete",
                description: "Firestore has been populated with mock data.",
                variant: "default",
                className: "bg-green-100 border-green-300 text-green-800",
            });

        } catch (error) {
            console.error("Error seeding database:", error);
            toast({
                title: "Seeding Failed",
                description: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
                variant: "destructive",
            });
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="container mx-auto p-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-6 w-6" />
                        Seed Firestore Database
                    </CardTitle>
                    <CardDescription>
                        Populate your Firestore database with mock data for testing purposes.
                        This will overwrite existing data in the specified collections/documents.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {firebaseError && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Firebase Error</AlertTitle>
                            <AlertDescription>{firebaseError}</AlertDescription>
                        </Alert>
                    )}
                    <p>Click the button below to add mock users, patient health data, medications, symptoms, and chat messages to Firestore.</p>
                    <p className="text-sm text-muted-foreground">
                        Ensure your Firebase project is correctly configured in your <code>.env.local</code> file.
                        The seeding process uses placeholder IDs: <code>{PLACEHOLDER_PATIENT_ID}</code>, <code>{PLACEHOLDER_DOCTOR_ID}</code>, and <code>{PLACEHOLDER_ADMIN_ID}</code>.
                    </p>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={seedDatabase}
                        disabled={isSeeding || !!firebaseError} // Disable if seeding or if there's a config error
                    >
                        {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSeeding ? 'Seeding...' : 'Seed Database'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}


// ShadCN Card components (assuming they exist in ui/card)
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
