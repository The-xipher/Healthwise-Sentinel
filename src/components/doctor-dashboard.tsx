'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, Timestamp, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

interface DoctorDashboardProps {
  user: User; // Doctor's user object
}

interface Patient {
  id: string; // Firestore document ID (usually user.uid for the patient)
  name: string;
  email?: string; // Optional
  photoURL?: string; // Optional
  lastActivity?: Timestamp; // Optional: For sorting or display
  // Add other relevant patient metadata if needed (e.g., assignedDoctorId)
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

export default function DoctorDashboard({ user }: DoctorDashboardProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientData, setSelectedPatientData] = useState<any>(null); // Simplified patient data for now
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
  const { toast } = useToast();


   // Fetch list of patients assigned to this doctor
   // This assumes a 'patients' collection where each doc has an 'assignedDoctorId' field.
   // Adjust the query based on your actual Firestore structure.
   useEffect(() => {
      setLoadingPatients(true);
      setError(null);
      const patientsQuery = query(collection(db, 'users'), where('role', '==', 'patient'), where('assignedDoctorId', '==', user.uid)); // Example query

      const unsubscribe = onSnapshot(patientsQuery, (snapshot) => {
         const patientList = snapshot.docs.map(doc => ({
           id: doc.id, // The patient's UID is the document ID here
           name: doc.data().displayName || 'Unknown Patient', // Assuming display name is stored
           email: doc.data().email,
           photoURL: doc.data().photoURL,
           // You might fetch/calculate lastActivity separately if needed
           readmissionRisk: doc.data().readmissionRisk || (Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low') // Simulate risk
         } as Patient));
         setPatients(patientList);
         setLoadingPatients(false);
       }, (err) => {
         console.error("Error fetching patients:", err);
         setError("Could not load patient list.");
         setLoadingPatients(false);
       });

     return () => unsubscribe();
   }, [user.uid]);


   // Fetch data for the selected patient when selectedPatientId changes
   useEffect(() => {
        if (!selectedPatientId) {
            setSelectedPatientData(null);
            setPatientHealthData([]);
            setPatientMedications([]);
            setAiSuggestions([]);
            setChatMessages([]);
            setHistorySummary(null);
            setCarePlan(null);
            return;
        }

        setLoadingPatientData(true);
        setLoadingAiSuggestions(true);
        setLoadingChat(true);
        setLoadingSummary(true);
        setLoadingCarePlan(true); // Start loading care plan
        setError(null);

        // --- Fetch Patient Profile ---
        const fetchPatientProfile = async () => {
             try {
                const patientDocRef = doc(db, 'users', selectedPatientId);
                const patientDoc = await getDoc(patientDocRef);
                if (patientDoc.exists()) {
                   setSelectedPatientData({ id: patientDoc.id, ...patientDoc.data() });

                   // --- Generate Patient History Summary ---
                    const history = patientDoc.data()?.medicalHistory || "No detailed history available."; // Get history field
                    if (history) {
                        try {
                            const summaryResult = await summarizePatientHistory({ patientId: selectedPatientId, medicalHistory: history });
                            setHistorySummary(summaryResult.summary);
                        } catch (summaryError) {
                            console.error("Error generating history summary:", summaryError);
                            setHistorySummary("Could not generate summary."); // Show error inline
                        } finally {
                            setLoadingSummary(false);
                        }
                    } else {
                       setHistorySummary("No medical history provided for summarization.");
                       setLoadingSummary(false);
                    }

                    // --- Generate Care Plan ---
                    const predictedRisks = patientDoc.data()?.readmissionRisk ? `Readmission Risk: ${patientDoc.data()?.readmissionRisk}` : "No specific risks predicted."; // Example risk data
                    const currentMedsString = patientMedications.map(m => `${m.name} (${m.dosage})`).join(', ') || "None listed";
                     try {
                       const carePlanResult = await generateCarePlan({
                         patientId: selectedPatientId,
                         predictedRisks: predictedRisks,
                         medicalHistory: history,
                         currentMedications: currentMedsString
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
                 setLoadingPatientData(false); // Profile loading finished (data or error)
            }
        };


        fetchPatientProfile();

        // --- Health Data Listener ---
         const healthQuery = query(
            collection(db, `patients/${selectedPatientId}/healthData`),
            orderBy('timestamp', 'desc'),
            limit(10) // Limit displayed entries if needed
        );
        const unsubscribeHealth = onSnapshot(healthQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data() as PatientHealthData);
            setPatientHealthData(data);
        }, (err) => {
            console.error("Error fetching patient health data:", err);
            // Don't set global error, maybe show inline indicator
        });


         // --- Medication Listener ---
         const medsQuery = query(collection(db, `patients/${selectedPatientId}/medications`));
         const unsubscribeMeds = onSnapshot(medsQuery, (snapshot) => {
             const meds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PatientMedication));
              // Simulate adherence if not present
             const medsWithAdherence = meds.map(med => ({
                ...med,
                adherence: med.adherence ?? Math.floor(Math.random() * 31) + 70 // Simulate 70-100% adherence
             }));
             setPatientMedications(medsWithAdherence);
         }, (err) => {
             console.error("Error fetching patient medications:", err);
         });


        // --- AI Suggestions Listener ---
        // Assuming suggestions are stored per-patient
        const suggestionsQuery = query(
            collection(db, `patients/${selectedPatientId}/aiSuggestions`),
            orderBy('timestamp', 'desc')
        );
        const unsubscribeSuggestions = onSnapshot(suggestionsQuery, (snapshot) => {
            const suggestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AISuggestion));
            setAiSuggestions(suggestions);
            setLoadingAiSuggestions(false);
        }, (err) => {
            console.error("Error fetching AI suggestions:", err);
            setLoadingAiSuggestions(false);
            // Maybe show inline error
        });

       // --- Generate New Suggestions if needed ---
        const generateNewSuggestions = async () => {
           // Avoid generating if already loading or recently generated
            if (loadingAiSuggestions || aiSuggestions.some(s => s.status === 'pending')) return;

            setLoadingAiSuggestions(true);
            try {
                const latestHealth = patientHealthData.length > 0 ? patientHealthData[0] : {}; // Assuming descending order
                const healthSummary = `Latest Health: Steps: ${latestHealth.steps ?? 'N/A'}, HR: ${latestHealth.heartRate ?? 'N/A'}. `;
                const adherenceSummary = patientMedications.map(m => `${m.name}: ${m.adherence ?? 'N/A'}%`).join(', ');
                // We might not have symptom reports readily available here without another query
                // const symptomsSummary = ...

                const input = {
                patientHealthData: `${healthSummary} Medication Adherence: ${adherenceSummary}.`,
                riskPredictions: `Readmission Risk: ${selectedPatientData?.readmissionRisk || 'Unknown'}.`, // Use fetched patient data
                };

                const result = await generateSuggestedInterventions(input);

                 // Add the new suggestion to Firestore with 'pending' status
                 await addDoc(collection(db, `patients/${selectedPatientId}/aiSuggestions`), {
                    suggestionText: result.suggestedInterventions,
                    timestamp: Timestamp.now(),
                    status: 'pending',
                    patientId: selectedPatientId,
                 });
                // The listener above will pick up the change and update the state.

            } catch (genError) {
                console.error('Error generating new suggestions:', genError);
                toast({ title: "Suggestion Generation Failed", description: "Could not generate new AI suggestions.", variant: "destructive" });
            } finally {
                // Listener will set loading to false
                // setLoadingAiSuggestions(false);
            }
        };
        // Optionally trigger suggestion generation based on some condition (e.g., no pending suggestions)
        // generateNewSuggestions();


         // --- Chat Messages Listener ---
        const chatQuery = query(
            collection(db, `chats/${getChatId(user.uid, selectedPatientId)}/messages`),
            orderBy('timestamp', 'asc') // Show oldest first
        );
        const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            setChatMessages(messages);
            setLoadingChat(false);
        }, (err) => {
            console.error("Error fetching chat messages:", err);
            setLoadingChat(false);
        });


        return () => {
             unsubscribeHealth();
             unsubscribeMeds();
             unsubscribeSuggestions();
             unsubscribeChat();
        };

   }, [selectedPatientId, user.uid]); // Re-run when patient selection changes


   // Helper to create a consistent chat ID between doctor and patient
   const getChatId = (doctorId: string, patientId: string): string => {
      return [doctorId, patientId].sort().join('_');
   };

   const handleSendMessage = async () => {
      if (!newMessage.trim() || !selectedPatientId) return;

      setSendingMessage(true);
      const chatId = getChatId(user.uid, selectedPatientId);
      try {
        await addDoc(collection(db, `chats/${chatId}/messages`), {
          senderId: user.uid, // Doctor's ID
          senderName: user.displayName || 'Doctor',
          text: newMessage,
          timestamp: Timestamp.now(),
        });
        setNewMessage(''); // Clear input after sending
      } catch (err) {
        console.error("Error sending message:", err);
        toast({ title: "Message Failed", description: "Could not send message.", variant: "destructive" });
      } finally {
        setSendingMessage(false);
      }
   };

   const handleSuggestionAction = async (suggestionId: string, action: 'approve' | 'reject') => {
        if (!selectedPatientId) return;
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
               <Select onValueChange={setSelectedPatientId} value={selectedPatientId || ''}>
                 <SelectTrigger className="w-full md:w-[300px]">
                   <SelectValue placeholder="Select a patient..." />
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
                     <div className="p-4 text-center text-muted-foreground">No patients assigned.</div>
                   )}
                 </SelectContent>
               </Select>
           )}
         </CardContent>
      </Card>

      {/* Patient Detail Section */}
      {selectedPatientId && (
         loadingPatientData || loadingSummary ? (
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
                             <Button size="sm" variant="outline" disabled={loadingCarePlan}>
                                 {/* Add functionality to edit/approve */}
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
                                {patientHealthData.slice(0, 5).map((data, index) => ( // Show latest 5
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
                              <Button variant="link" size="sm">View All Health Data</Button> {/* Link to full history */}
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
                              <Button variant="link" size="sm">Manage Medications</Button> {/* Link to med management */}
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
                                                    <Button size="sm" variant="outline" className="h-7 px-2 py-1 text-xs border-green-500 text-green-600 hover:bg-green-50" onClick={() => handleSuggestionAction(suggestion.id, 'approve')}>
                                                        <Check className="h-3 w-3 mr-1" /> Approve
                                                    </Button>
                                                     <Button size="sm" variant="outline" className="h-7 px-2 py-1 text-xs border-red-500 text-red-600 hover:bg-red-50" onClick={() => handleSuggestionAction(suggestion.id, 'reject')}>
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
                             {/* Optionally add button to explicitly trigger generation */}
                             {/* <Button size="sm" variant="outline" onClick={generateNewSuggestions} disabled={loadingAiSuggestions}>
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
                                        <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`p-2 rounded-lg max-w-[75%] ${msg.senderId === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                            <p className="text-sm">{msg.text}</p>
                                            <p className={`text-xs mt-1 ${msg.senderId === user.uid ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
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
                                />
                                <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()} size="icon">
                                    {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
         ) : selectedPatientId ? ( // Still selected but data is null (likely error state)
            <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Error Loading Patient Data</AlertTitle>
               <AlertDescription>{error || "Could not load data for the selected patient. Please try again or select a different patient."}</AlertDescription>
            </Alert>
         ) : null /* No patient selected view handled by lack of selectedPatientId */
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
