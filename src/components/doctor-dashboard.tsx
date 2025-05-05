'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
// Removed: import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, Timestamp, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, isFirebaseInitialized, getFirebaseConfigError } from '@/lib/firebase'; // Import helpers
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle, Users, Stethoscope, Activity, HeartPulse, Pill, MessageSquare, Send, Check, X, Info } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { summarizePatientHistory } from '@/ai/flows/summarize-patient-history'; // AI Summary Flow
import { generateCarePlan } from '@/ai/flows/generate-care-plan'; // AI Care Plan Flow
import { generateSuggestedInterventions } from '@/ai/flows/generate-suggested-interventions'; // AI Interventions Flow (reused)
import { useToast } from '@/hooks/use-toast';

// Removed: interface DoctorDashboardProps {
//   user: User; // Doctor's user object
// }

interface Patient {
  id: string; // Firestore document ID (usually user.uid for the patient)
  name: string;
  email?: string; // Optional
  photoURL?: string; // Optional
  lastActivity?: Timestamp; // Optional: For sorting or display
  assignedDoctorId?: string; // Keep this field for filtering
  readmissionRisk?: 'low' | 'medium' | 'high'; // Simulated or from AI
}

interface PatientHealthData {
   timestamp: Timestamp;
   steps?: number;
   heartRate?: number;
   // other fields...
}

interface PatientMedication {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    adherence?: number;
}

interface ChatMessage {
    id: string;
    senderId: string; // 'doctor' or patient's UID
    senderName: string; // Display name
    text: string;
    timestamp: Timestamp;
}

interface AISuggestion {
    id: string; // Firestore ID of the suggestion
    suggestionText: string;
    timestamp: Timestamp;
    status: 'pending' | 'approved' | 'rejected'; // Status managed by the doctor
    patientId: string; // Link suggestion to patient
}

// Using a placeholder ID since authentication is removed
const PLACEHOLDER_DOCTOR_ID = 'test-doctor-id';
const PLACEHOLDER_DOCTOR_NAME = 'Dr. Placeholder';

export default function DoctorDashboard(/* Removed: { user }: DoctorDashboardProps */) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientData, setSelectedPatientData] = useState<any>(null);
  const [patientHealthData, setPatientHealthData] = useState<PatientHealthData[]>([]);
  const [patientMedications, setPatientMedications] = useState<PatientMedication[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingPatientData, setLoadingPatientData] = useState(false);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [historySummary, setHistorySummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [carePlan, setCarePlan] = useState<string | null>(null);
  const [loadingCarePlan, setLoadingCarePlan] = useState(false);
  const [firebaseActive, setFirebaseActive] = useState(false);
  const { toast } = useToast();


   useEffect(() => {
        const firebaseReady = isFirebaseInitialized();
        setFirebaseActive(firebaseReady);
        if (!firebaseReady) {
            setError(getFirebaseConfigError() || "Firebase is not available.");
            setLoadingPatients(false);
            // Reset other loading states as well
            setLoadingPatientData(false);
            setLoadingAiSuggestions(false);
            setLoadingChat(false);
            setLoadingSummary(false);
            setLoadingCarePlan(false);
            return; // Stop if Firebase isn't working
        }
        // If Firebase is ready, proceed
        setError(null); // Clear potential config error

        setLoadingPatients(true);
        // Fetch patients assigned to the placeholder doctor ID
        const patientsQuery = query(
            collection(db!, 'users'), // Use non-null assertion db!
            where('role', '==', 'patient'),
            where('assignedDoctorId', '==', PLACEHOLDER_DOCTOR_ID) // Filter by placeholder doctor
        );

        const unsubscribe = onSnapshot(patientsQuery, (snapshot) => {
            const patientList = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().displayName || 'Unknown Patient',
                email: doc.data().email,
                photoURL: doc.data().photoURL,
                assignedDoctorId: doc.data().assignedDoctorId,
                readmissionRisk: doc.data().readmissionRisk || (Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low')
            } as Patient));
            setPatients(patientList);
            setLoadingPatients(false);
        }, (err) => {
            console.error("Error fetching patients:", err);
            setError("Could not load patient list.");
            setLoadingPatients(false);
        });

        return () => unsubscribe();
   }, []); // Run only once on mount


   // Fetch data for the selected patient when selectedPatientId changes
   useEffect(() => {
        if (!firebaseActive || !selectedPatientId) {
            // Reset states if Firebase is off or no patient selected
            setSelectedPatientData(null);
            setPatientHealthData([]);
            setPatientMedications([]);
            setAiSuggestions([]);
            setChatMessages([]);
            setHistorySummary(null);
            setCarePlan(null);
            // Set loading states to false if not loading patients
            if (!loadingPatients) {
                setLoadingPatientData(false);
                setLoadingAiSuggestions(false);
                setLoadingChat(false);
                setLoadingSummary(false);
                setLoadingCarePlan(false);
            }
            return;
        }

        // Proceed if Firebase is active and a patient is selected
        setLoadingPatientData(true);
        setLoadingAiSuggestions(true);
        setLoadingChat(true);
        setLoadingSummary(true);
        setLoadingCarePlan(true);
        setError(null);

        let unsubscribeHealth: (() => void) | null = null;
        let unsubscribeMeds: (() => void) | null = null;
        let unsubscribeSuggestions: (() => void) | null = null;
        let unsubscribeChat: (() => void) | null = null;


        // --- Fetch Patient Profile and Generate AI Content ---
        const fetchPatientProfileAndAI = async () => {
             try {
                const patientDocRef = doc(db!, 'users', selectedPatientId); // Use db!
                const patientDoc = await getDoc(patientDocRef);
                if (patientDoc.exists()) {
                   const patientData = { id: patientDoc.id, ...patientDoc.data() };
                   setSelectedPatientData(patientData);

                   // --- Generate Patient History Summary ---
                    const history = patientData?.medicalHistory || "No detailed history available.";
                    setLoadingSummary(true);
                    try {
                        const summaryResult = await summarizePatientHistory({ patientId: selectedPatientId, medicalHistory: history });
                        setHistorySummary(summaryResult.summary);
                    } catch (summaryError) {
                        console.error("Error generating history summary:", summaryError);
                        setHistorySummary("Could not generate summary.");
                    } finally {
                        setLoadingSummary(false);
                    }

                    // --- Generate Care Plan ---
                    const predictedRisks = patientData?.readmissionRisk ? `Readmission Risk: ${patientData?.readmissionRisk}` : "No specific risks predicted.";
                    // Note: patientMedications might not be loaded yet when this runs first time
                    const currentMedsString = medications.map(m => `${m.name} (${m.dosage})`).join(', ') || "None listed";
                    setLoadingCarePlan(true);
                     try {
                       const carePlanResult = await generateCarePlan({
                         patientId: selectedPatientId,
                         predictedRisks: predictedRisks,
                         medicalHistory: history,
                         currentMedications: currentMedsString // May be empty initially
                       });
                       setCarePlan(carePlanResult.carePlan);
                     } catch (carePlanError) {
                       console.error("Error generating care plan:", carePlanError);
                       setCarePlan("Could not generate care plan.");
                     } finally {
                        setLoadingCarePlan(false);
                     }

                } else {
                    setError(`Patient profile not found for ID: ${selectedPatientId}`);
                    setSelectedPatientData(null);
                    setLoadingSummary(false);
                    setLoadingCarePlan(false);
                }
            } catch (err) {
                console.error("Error fetching patient profile:", err);
                setError("Could not load patient profile data.");
                setSelectedPatientData(null);
                setLoadingSummary(false);
                setLoadingCarePlan(false);
            } finally {
                 setLoadingPatientData(false);
            }
        };

        fetchPatientProfileAndAI();

        // --- Health Data Listener ---
         const healthQuery = query(
            collection(db!, `patients/${selectedPatientId}/healthData`),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        unsubscribeHealth = onSnapshot(healthQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data() as PatientHealthData);
            setPatientHealthData(data);
        }, (err) => console.error("Error fetching patient health data:", err));


         // --- Medication Listener ---
         const medsQuery = query(collection(db!, `patients/${selectedPatientId}/medications`));
         unsubscribeMeds = onSnapshot(medsQuery, (snapshot) => {
             const meds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PatientMedication));
             const medsWithAdherence = meds.map(med => ({
                ...med,
                adherence: med.adherence ?? Math.floor(Math.random() * 31) + 70
             }));
             setPatientMedications(medsWithAdherence);
             // Re-generate care plan if meds data influences it significantly and plan wasn't generated yet
             // This logic might be complex, consider if really needed or generate plan once profile loads
             // if (!loadingCarePlan && carePlan === "No care plan generated yet.") {
             //    fetchPatientProfileAndAI(); // Re-trigger fetch/generation
             // }
         }, (err) => console.error("Error fetching patient medications:", err));


        // --- AI Suggestions Listener ---
        const suggestionsQuery = query(
            collection(db!, `patients/${selectedPatientId}/aiSuggestions`),
            orderBy('timestamp', 'desc')
        );
        unsubscribeSuggestions = onSnapshot(suggestionsQuery, (snapshot) => {
            const suggestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AISuggestion));
            setAiSuggestions(suggestions);
            setLoadingAiSuggestions(false);
            // Optionally trigger generation if no pending suggestions exist
            // generateNewSuggestionsIfNeeded(suggestions);
        }, (err) => {
            console.error("Error fetching AI suggestions:", err);
            setLoadingAiSuggestions(false);
        });

         // --- Chat Messages Listener ---
        const chatId = getChatId(PLACEHOLDER_DOCTOR_ID, selectedPatientId);
        const chatQuery = query(
            collection(db!, `chats/${chatId}/messages`),
            orderBy('timestamp', 'asc')
        );
        unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            setChatMessages(messages);
            setLoadingChat(false);
        }, (err) => {
            console.error("Error fetching chat messages:", err);
            setLoadingChat(false);
        });


        return () => {
             unsubscribeHealth?.();
             unsubscribeMeds?.();
             unsubscribeSuggestions?.();
             unsubscribeChat?.();
        };

   }, [selectedPatientId, firebaseActive]); // Re-run when patient or firebase status changes


   // Helper to create a consistent chat ID between doctor and patient
   const getChatId = (doctorId: string, patientId: string): string => {
      return [doctorId, patientId].sort().join('_');
   };

   const handleSendMessage = async () => {
      if (!firebaseActive || !db || !newMessage.trim() || !selectedPatientId) {
          toast({ title: "Cannot Send", description: "Message is empty or connection issue.", variant: "destructive"});
          return;
      }

      setSendingMessage(true);
      const chatId = getChatId(PLACEHOLDER_DOCTOR_ID, selectedPatientId);
      try {
        await addDoc(collection(db, `chats/${chatId}/messages`), {
          senderId: PLACEHOLDER_DOCTOR_ID, // Doctor's placeholder ID
          senderName: PLACEHOLDER_DOCTOR_NAME, // Doctor's placeholder Name
          text: newMessage,
          timestamp: Timestamp.now(),
        });
        setNewMessage('');
      } catch (err) {
        console.error("Error sending message:", err);
        toast({ title: "Message Failed", description: "Could not send message.", variant: "destructive" });
      } finally {
        setSendingMessage(false);
      }
   };

   const handleSuggestionAction = async (suggestionId: string, action: 'approve' | 'reject') => {
        if (!firebaseActive || !db || !selectedPatientId) {
            toast({ title: "Action Failed", description: "Connection issue.", variant: "destructive"});
            return;
        }
        const suggestionRef = doc(db, `patients/${selectedPatientId}/aiSuggestions`, suggestionId);
        try {
            await updateDoc(suggestionRef, {
                status: action === 'approve' ? 'approved' : 'rejected'
            });
            toast({
                title: `Suggestion ${action === 'approve' ? 'Approved' : 'Rejected'}`,
                description: `The AI suggestion status has been updated.`,
            });
        } catch (err) {
            console.error(`Error ${action}ing suggestion:`, err);
            toast({ title: "Update Failed", description: `Could not ${action} the suggestion.`, variant: "destructive" });
        }
   };

    const formatTimestamp = (timestamp: Timestamp | undefined): string => {
        if (!timestamp) return 'N/A';
        return timestamp.toDate().toLocaleString();
    };

    const selectedPatient = useMemo(() => {
       return patients.find(p => p.id === selectedPatientId);
    }, [patients, selectedPatientId]);

  // Determine if core patient data is loading
  const coreDataLoading = firebaseActive && (loadingPatientData || loadingSummary || loadingCarePlan || loadingAiSuggestions || loadingChat);


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
         <Stethoscope className="h-7 w-7" /> Doctor Dashboard
      </h1>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

       {!firebaseActive && !error && (
           <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800">
               <AlertTriangle className="h-4 w-4 text-yellow-600" />
               <AlertTitle>Firebase Disabled</AlertTitle>
               <AlertDescription>
                   Database features are currently offline. Patient data cannot be loaded or updated.
               </AlertDescription>
           </Alert>
       )}

      <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5"/> Select Patient
            </CardTitle>
             <CardDescription>Choose a patient to view their details and insights.</CardDescription>
         </CardHeader>
         <CardContent>
           {loadingPatients ? (
               <Skeleton className="h-10 w-full" />
           ) : (
               <Select
                 onValueChange={setSelectedPatientId}
                 value={selectedPatientId || ''}
                 disabled={!firebaseActive || patients.length === 0} // Disable if Firebase off or no patients
                >
                 <SelectTrigger className="w-full md:w-[300px]">
                   <SelectValue placeholder={firebaseActive ? "Select a patient..." : "Patient list unavailable"} />
                 </SelectTrigger>
                 <SelectContent>
                   {patients.length > 0 ? (
                     patients.map((patient) => (
                       <SelectItem key={patient.id} value={patient.id}>
                         <div className="flex items-center gap-2">
                           <Avatar className="h-6 w-6">
                             <AvatarImage src={patient.photoURL} alt={patient.name} />
                             <AvatarFallback>{patient.name?.charAt(0) ?? 'P'}</AvatarFallback>
                           </Avatar>
                           <span>{patient.name}</span>
                            {patient.readmissionRisk && (
                                <Badge variant={patient.readmissionRisk === 'high' ? 'destructive' : patient.readmissionRisk === 'medium' ? 'secondary' : 'default'} className="ml-auto text-xs">
                                {patient.readmissionRisk} risk
                                </Badge>
                            )}
                         </div>
                       </SelectItem>
                     ))
                   ) : (
                     <div className="p-4 text-center text-muted-foreground">
                        {firebaseActive ? "No patients assigned." : "Patient data unavailable."}
                     </div>
                   )}
                 </SelectContent>
               </Select>
           )}
         </CardContent>
      </Card>

      {/* Patient Detail Section */}
      {selectedPatientId && firebaseActive && (
         coreDataLoading ? (
            <DashboardSkeleton /> // Show skeleton while core data loads
         ) : selectedPatientData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Patient Info, Summary, Care Plan */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Patient Info Card */}
                     <Card>
                        <CardHeader className="flex flex-row items-center gap-4">
                             <Avatar className="h-16 w-16">
                                 <AvatarImage src={selectedPatient?.photoURL} alt={selectedPatient?.name} />
                                 <AvatarFallback>{selectedPatient?.name?.charAt(0) ?? 'P'}</AvatarFallback>
                             </Avatar>
                            <div>
                                <CardTitle>{selectedPatient?.name}</CardTitle>
                                <CardDescription>{selectedPatient?.email}</CardDescription>
                                {selectedPatient?.readmissionRisk && (
                                    <Badge variant={selectedPatient.readmissionRisk === 'high' ? 'destructive' : selectedPatient.readmissionRisk === 'medium' ? 'secondary' : 'default'} className="mt-1 text-xs">
                                    {selectedPatient.readmissionRisk} readmission risk
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Add more patient details if needed */}
                            <p className="text-xs text-muted-foreground">Patient ID: {selectedPatient?.id}</p>
                        </CardContent>
                    </Card>

                    {/* AI Summary Card */}
                     <Card>
                        <CardHeader>
                            <CardTitle>AI Patient Summary</CardTitle>
                            <CardDescription>Key points from the patient's history.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingSummary ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            ): (
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{historySummary || "No summary available."}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI Care Plan Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Generated Care Plan</CardTitle>
                            <CardDescription>Initial draft based on patient data.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {loadingCarePlan ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            ): (
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{carePlan || "No care plan generated yet."}</p>
                            )}
                        </CardContent>
                         <CardFooter>
                             <Button size="sm" variant="outline" disabled={loadingCarePlan || !firebaseActive}>
                                 Edit/Approve Plan
                             </Button>
                         </CardFooter>
                    </Card>

                </div>

                {/* Middle Column: Health Data, Medications, AI Suggestions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Health Data Snippet */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5"/> Recent Health Data</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {patientHealthData.length > 0 ? (
                                <ul className="space-y-2 text-sm">
                                {patientHealthData.slice(0, 5).map((data, index) => (
                                    <li key={index} className="flex justify-between items-center border-b pb-1">
                                        <span>{formatTimestamp(data.timestamp)}</span>
                                        <div className="flex gap-3 text-xs text-muted-foreground">
                                            {data.steps !== undefined && <span><Activity className="inline h-3 w-3 mr-1"/>{data.steps}</span>}
                                            {data.heartRate !== undefined && <span><HeartPulse className="inline h-3 w-3 mr-1"/>{data.heartRate} bpm</span>}
                                        </div>
                                    </li>
                                ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">No recent health data.</p>
                            )}
                        </CardContent>
                         <CardFooter>
                              <Button variant="link" size="sm" disabled={!firebaseActive}>View All Health Data</Button>
                         </CardFooter>
                    </Card>

                     {/* Medication Snippet */}
                     <Card>
                         <CardHeader>
                             <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5"/> Medication Overview</CardTitle>
                         </CardHeader>
                         <CardContent>
                              {patientMedications.length > 0 ? (
                                 <ul className="space-y-2 text-sm">
                                 {patientMedications.map(med => (
                                     <li key={med.id} className="flex justify-between items-center border-b pb-1">
                                         <span>{med.name} ({med.dosage})</span>
                                         <Badge variant={med.adherence && med.adherence >= 90 ? 'default' : med.adherence && med.adherence >= 70 ? 'secondary' : 'destructive'} className="text-xs">
                                            {med.adherence !== undefined ? `${med.adherence}% adherence` : 'N/A'}
                                         </Badge>
                                     </li>
                                 ))}
                                 </ul>
                             ) : (
                                 <p className="text-sm text-muted-foreground">No medications assigned.</p>
                             )}
                         </CardContent>
                         <CardFooter>
                              <Button variant="link" size="sm" disabled={!firebaseActive}>Manage Medications</Button>
                         </CardFooter>
                     </Card>

                     {/* AI Suggestions Card */}
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5"/> AI Suggested Interventions</CardTitle>
                             <CardDescription>Review and act on AI-driven suggestions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {loadingAiSuggestions ? (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : aiSuggestions.length > 0 ? (
                                <ScrollArea className="h-[200px] pr-4">
                                <ul className="space-y-3">
                                    {aiSuggestions.map(suggestion => (
                                    <li key={suggestion.id} className="p-3 border rounded-md bg-muted/50 space-y-2">
                                        <p className="text-sm">{suggestion.suggestionText}</p>
                                         <div className="flex justify-between items-center">
                                             <span className="text-xs text-muted-foreground">{formatTimestamp(suggestion.timestamp)}</span>
                                              {suggestion.status === 'pending' ? (
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" className="h-7 px-2 py-1 text-xs border-green-500 text-green-600 hover:bg-green-50" onClick={() => handleSuggestionAction(suggestion.id, 'approve')} disabled={!firebaseActive}>
                                                        <Check className="h-3 w-3 mr-1" /> Approve
                                                    </Button>
                                                     <Button size="sm" variant="outline" className="h-7 px-2 py-1 text-xs border-red-500 text-red-600 hover:bg-red-50" onClick={() => handleSuggestionAction(suggestion.id, 'reject')} disabled={!firebaseActive}>
                                                        <X className="h-3 w-3 mr-1" /> Reject
                                                    </Button>
                                                </div>
                                            ) : (
                                                 <Badge variant={suggestion.status === 'approved' ? 'default' : 'destructive'} className="text-xs capitalize">
                                                    {suggestion.status}
                                                 </Badge>
                                            )}
                                         </div>
                                    </li>
                                    ))}
                                </ul>
                                </ScrollArea>
                            ) : (
                                <p className="text-sm text-muted-foreground">No suggestions available.</p>
                            )}
                        </CardContent>
                          <CardFooter>
                             {/* <Button size="sm" variant="outline" onClick={generateNewSuggestions} disabled={loadingAiSuggestions || !firebaseActive}>
                                {loadingAiSuggestions ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : null} Generate New Suggestions
                             </Button> */}
                          </CardFooter>
                    </Card>
                </div>

                 {/* Right Column: Chat */}
                <div className="lg:col-span-1 flex flex-col">
                     <Card className="flex-grow flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/> Chat with Patient</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-hidden flex flex-col p-0">
                           <ScrollArea className="flex-grow p-4">
                                {loadingChat ? (
                                    <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                                ) : chatMessages.length > 0 ? (
                                    <div className="space-y-4">
                                    {chatMessages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.senderId === PLACEHOLDER_DOCTOR_ID ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`p-2 rounded-lg max-w-[75%] ${msg.senderId === PLACEHOLDER_DOCTOR_ID ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                            <p className="text-sm">{msg.text}</p>
                                            <p className={`text-xs mt-1 ${msg.senderId === PLACEHOLDER_DOCTOR_ID ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                            {msg.senderName} - {formatTimestamp(msg.timestamp)}
                                            </p>
                                        </div>
                                        </div>
                                    ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">No messages yet.</p>
                                )}
                           </ScrollArea>
                        </CardContent>
                        <CardFooter className="p-4 border-t">
                             <div className="flex w-full items-center gap-2">
                                <Textarea
                                placeholder="Type your message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="flex-grow resize-none min-h-[40px] h-10"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                 disabled={sendingMessage || !firebaseActive} // Disable if sending or Firebase inactive
                                />
                                <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim() || !firebaseActive} size="icon">
                                    {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
         ) : selectedPatientId && !coreDataLoading ? ( // Handle error case after loading finishes
            <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Error Loading Patient Data</AlertTitle>
               <AlertDescription>{error || "Could not load data for the selected patient. Please try again or select a different patient."}</AlertDescription>
            </Alert>
         ) : null /* No patient selected view handled by lack of selectedPatientId */
      )}

        {/* Display message if Firebase is disabled and no patient is selected */}
        {!selectedPatientId && !firebaseActive && (
             <Card>
                 <CardContent className="pt-6">
                     <p className="text-center text-muted-foreground">Select a patient to view details (Feature requires active database connection).</p>
                 </CardContent>
             </Card>
        )}
    </div>
  );
}


// Skeleton Loader for the detailed patient view
function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column Skeleton */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
             <Skeleton className="h-16 w-16 rounded-full" />
             <div className="space-y-2">
               <Skeleton className="h-6 w-32" />
               <Skeleton className="h-4 w-48" />
               <Skeleton className="h-5 w-20" />
             </div>
          </CardHeader>
          <CardContent><Skeleton className="h-4 w-full" /></CardContent>
        </Card>
         <Card>
             <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
             <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
             </CardContent>
         </Card>
          <Card>
              <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
              <CardContent className="space-y-2">
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-5/6" />
              </CardContent>
              <CardFooter><Skeleton className="h-8 w-24" /></CardFooter>
          </Card>
      </div>

      {/* Middle Column Skeleton */}
      <div className="lg:col-span-1 space-y-6">
         <Card>
             <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
             <CardContent className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
             </CardContent>
             <CardFooter><Skeleton className="h-6 w-24" /></CardFooter>
         </Card>
         <Card>
             <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
             <CardContent className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
             </CardContent>
             <CardFooter><Skeleton className="h-6 w-32" /></CardFooter>
         </Card>
          <Card>
             <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
             <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
      </div>

      {/* Right Column Skeleton */}
      <div className="lg:col-span-1 flex flex-col">
         <Card className="flex-grow flex flex-col">
             <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
             <CardContent className="flex-grow"><Skeleton className="h-full w-full" /></CardContent>
             <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
         </Card>
      </div>
    </div>
  );
}
