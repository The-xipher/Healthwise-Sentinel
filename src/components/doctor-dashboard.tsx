
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
// Removed direct mongodb imports: connectToDatabase, toObjectId
import type { ObjectId } from 'mongodb'; // Keep for type definitions if necessary, server actions will handle ObjectId
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
import { summarizePatientHistory } from '@/ai/flows/summarize-patient-history';
import { generateCarePlan } from '@/ai/flows/generate-care-plan';
// import { generateSuggestedInterventions } from '@/ai/flows/generate-suggested-interventions'; // This seems to be Patient specific AI
import { useToast } from '@/hooks/use-toast';
import { 
  fetchDoctorPatientsAction, 
  fetchDoctorPatientDetailsAction,
  sendChatMessageAction,
  updateSuggestionStatusAction,
  DoctorPatient,
  DoctorPatientHealthData,
  DoctorPatientMedication,
  DoctorChatMessage,
  DoctorAISuggestion
} from '@/app/actions/doctorActions'; // Import server actions

// Updated to a valid 24-character hex string for MongoDB ObjectId compatibility
const PLACEHOLDER_DOCTOR_ID = '507f1f77bcf86cd799439012'; 
const PLACEHOLDER_DOCTOR_NAME = 'Dr. Placeholder';

export default function DoctorDashboard() {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientData, setSelectedPatientData] = useState<DoctorPatient | null>(null);
  const [patientHealthData, setPatientHealthData] = useState<DoctorPatientHealthData[]>([]);
  const [patientMedications, setPatientMedications] = useState<DoctorPatientMedication[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<DoctorAISuggestion[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingPatientDetails, setLoadingPatientDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<DoctorChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [historySummary, setHistorySummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [carePlan, setCarePlan] = useState<string | null>(null);
  const [loadingCarePlan, setLoadingCarePlan] = useState(false);
  const { toast } = useToast();
  const [dbAvailable, setDbAvailable] = useState(true);

  useEffect(() => {
    async function loadInitialData() {
      setLoadingPatients(true);
      setError(null);
      try {
        // Assuming PLACEHOLDER_DOCTOR_ID is a string that might represent an ObjectId
        // or another unique identifier stored as string in `assignedDoctorId`.
        // If `assignedDoctorId` in DB is ObjectId, PLACEHOLDER_DOCTOR_ID needs to be a valid hex string for conversion.
        // If `assignedDoctorId` is string, this direct use is fine.
        const result = await fetchDoctorPatientsAction(PLACEHOLDER_DOCTOR_ID);
        if (result.error) {
          setError(result.error);
          if (result.error.includes("Database connection") || result.error.includes("Invalid ID format")) {
            setDbAvailable(false);
          }
          setPatients([]);
        } else {
          setPatients(result.patients || []);
          setDbAvailable(true);
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred.');
        setDbAvailable(false);
        setPatients([]);
        console.error(e);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatientData(null);
      setPatientHealthData([]);
      setPatientMedications([]);
      setAiSuggestions([]);
      setChatMessages([]);
      setHistorySummary(null);
      setCarePlan(null);
      setLoadingPatientDetails(false); // Ensure this resets
      return;
    }

    async function fetchPatientAllData() {
      setLoadingPatientDetails(true);
      setError(null); // Clear previous patient-specific errors
      setHistorySummary(null); // Reset AI summaries
      setCarePlan(null);

      try {
        // selectedPatientId is expected to be a valid ObjectId string here
        const result = await fetchDoctorPatientDetailsAction(selectedPatientId, PLACEHOLDER_DOCTOR_ID);
        if (result.error) {
          setError(result.error);
           if (result.error.includes("Database connection") || result.error.includes("Invalid patient ID format")) {
            setDbAvailable(false); 
          }
          // Clear out data for safety
            setSelectedPatientData(null);
            setPatientHealthData([]);
            setPatientMedications([]);
            setAiSuggestions([]);
            setChatMessages([]);
        } else {
          setSelectedPatientData(result.patient || null);
          setPatientHealthData(result.healthData || []);
          setPatientMedications(result.medications || []);
          setAiSuggestions(result.aiSuggestions || []);
          setChatMessages(result.chatMessages || []);
          setDbAvailable(true);

          if (result.patient) {
            setLoadingSummary(true);
            try {
              const summaryResult = await summarizePatientHistory({
                patientId: selectedPatientId, // Already a string ID from patient object
                medicalHistory: result.patient.medicalHistory || "No detailed history available."
              });
              setHistorySummary(summaryResult.summary);
            } catch (e) { console.error("AI Summary Error", e); setHistorySummary("Could not generate summary."); }
            finally { setLoadingSummary(false); }

            setLoadingCarePlan(true);
            try {
                const currentMedsString = (result.medications || []).map(m => `${m.name} (${m.dosage})`).join(', ') || "None listed";
                // Use a more descriptive risk string if available
                const predictedRisks = result.patient?.readmissionRisk ? `Readmission Risk: ${result.patient.readmissionRisk}` : "No specific risks predicted.";
                const carePlanResult = await generateCarePlan({
                  patientId: selectedPatientId, // Already a string ID
                  predictedRisks: predictedRisks,
                  medicalHistory: result.patient.medicalHistory || "No detailed history available.",
                  currentMedications: currentMedsString
                });
                setCarePlan(carePlanResult.carePlan);
            } catch (e) { console.error("AI Care Plan Error", e); setCarePlan("Could not generate care plan.");}
            finally { setLoadingCarePlan(false); }
          }
        }
      } catch (e: any) {
        setError(e.message || "An unexpected error occurred fetching patient details.");
        setDbAvailable(false);
        console.error(e);
      } finally {
        setLoadingPatientDetails(false);
      }
    }

    fetchPatientAllData();
  }, [selectedPatientId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPatientId) {
      toast({ title: "Cannot Send", description: "Message is empty or no patient selected.", variant: "destructive" });
      return;
    }
    setSendingMessage(true);
    try {
      // PLACEHOLDER_DOCTOR_ID and selectedPatientId are strings
      const result = await sendChatMessageAction(PLACEHOLDER_DOCTOR_ID, PLACEHOLDER_DOCTOR_NAME, selectedPatientId, newMessage);
      if (result.error) {
        toast({ title: "Message Failed", description: result.error, variant: "destructive" });
      } else if (result.message) {
        setChatMessages(prev => [...prev, result.message!]);
        setNewMessage('');
      }
    } catch (err) {
      console.error("Error sending message:", err);
      toast({ title: "Message Failed", description: "Could not send message.", variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSuggestionAction = async (suggestionIdStr: string, action: 'approved' | 'rejected') => {
    if (!selectedPatientId) {
      toast({ title: "Action Failed", description: "No patient selected.", variant: "destructive" });
      return;
    }
    try {
      // suggestionIdStr and selectedPatientId are expected to be valid ObjectId strings
      const result = await updateSuggestionStatusAction(suggestionIdStr, selectedPatientId, action);
      if (result.error) {
        toast({ title: "Update Failed", description: result.error, variant: "destructive" });
      } else if (result.updatedSuggestion) {
        setAiSuggestions(prev => prev.map(s => s.id === suggestionIdStr ? { ...s, status: action } : s));
        toast({
          title: `Suggestion ${action === 'approved' ? 'Approved' : 'Rejected'}`,
          description: `The AI suggestion status has been updated.`,
        });
      }
    } catch (err) {
      console.error(`Error ${action}ing suggestion:`, err);
      toast({ title: "Update Failed", description: `Could not ${action} the suggestion.`, variant: "destructive" });
    }
    // Removed finally setSendingMessage(false) as it's not related to message sending
  };

  const formatTimestamp = (timestamp: Date | string | undefined): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const selectedPatientFullData = useMemo(() => { // Renamed to avoid conflict with the state variable 'selectedPatientData'
    return patients.find(p => p.id === selectedPatientId);
  }, [patients, selectedPatientId]);
  
  const coreDataLoading = loadingPatientDetails; // This flag can determine if the main section skeleton is shown

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

      {!dbAvailable && !loadingPatients && !loadingPatientDetails && ( // Only show if not loading and DB is confirmed unavailable
        <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>Database Disconnected</AlertTitle>
          <AlertDescription>
            Database features are currently offline. Patient data cannot be loaded or updated. Check .env and MongoDB connection.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Select Patient
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
              disabled={!dbAvailable || patients.length === 0}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder={!dbAvailable ? "Patient list unavailable" : (patients.length === 0 ? "No patients assigned" : "Select a patient...")} />
              </SelectTrigger>
              <SelectContent>
                {patients.length > 0 ? (
                  patients.map((patient) => (
                    <SelectItem key={patient.id!} value={patient.id!}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={patient.photoURL} alt={patient.name} data-ai-hint="profile person" />
                          <AvatarFallback>{patient.name?.charAt(0)?.toUpperCase() ?? 'P'}</AvatarFallback>
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
                    {dbAvailable ? "No patients assigned." : "Patient data unavailable."}
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedPatientId && dbAvailable && ( // Check dbAvailable here
        coreDataLoading ? ( // Main skeleton for patient details section
          <DashboardSkeleton />
        ) : selectedPatientData ? ( // Render patient details if data is loaded
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Patient Info Column */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedPatientFullData?.photoURL} alt={selectedPatientFullData?.name} data-ai-hint="profile person" />
                    <AvatarFallback>{selectedPatientFullData?.name?.charAt(0)?.toUpperCase() ?? 'P'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{selectedPatientFullData?.name}</CardTitle>
                    <CardDescription>{selectedPatientFullData?.email}</CardDescription>
                    {selectedPatientFullData?.readmissionRisk && (
                      <Badge variant={selectedPatientFullData.readmissionRisk === 'high' ? 'destructive' : selectedPatientFullData.readmissionRisk === 'medium' ? 'secondary' : 'default'} className="mt-1 text-xs">
                        {selectedPatientFullData.readmissionRisk} readmission risk
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Patient ID: {selectedPatientFullData?.id}</p>
                </CardContent>
              </Card>

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
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{historySummary || "No summary available."}</p>
                  )}
                </CardContent>
              </Card>

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
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{carePlan || "No care plan generated yet."}</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="outline" disabled={loadingCarePlan || !dbAvailable}>
                    Edit/Approve Plan
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Health Data & Meds Column */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent Health Data</CardTitle>
                </CardHeader>
                <CardContent>
                  {patientHealthData.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {patientHealthData.slice(0, 5).map((data, index) => (
                        <li key={data.id || index.toString()} className="flex justify-between items-center border-b pb-1">
                          <span>{formatTimestamp(data.timestamp)}</span>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {data.steps !== undefined && <span><Activity className="inline h-3 w-3 mr-1" />{data.steps}</span>}
                            {data.heartRate !== undefined && <span><HeartPulse className="inline h-3 w-3 mr-1" />{data.heartRate} bpm</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent health data.</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="link" size="sm" disabled={!dbAvailable}>View All Health Data</Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" /> Medication Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  {patientMedications.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {patientMedications.map(med => (
                        <li key={med.id!} className="flex justify-between items-center border-b pb-1">
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
                  <Button variant="link" size="sm" disabled={!dbAvailable}>Manage Medications</Button>
                </CardFooter>
              </Card>

               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> AI Suggested Interventions</CardTitle>
                  <CardDescription>Review and act on AI-driven suggestions.</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Show loader if patient details loading and no suggestions yet, or explicitly loading suggestions */}
                  {(loadingPatientDetails && !aiSuggestions.length) ? ( 
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : aiSuggestions.length > 0 ? (
                    <ScrollArea className="h-[200px] pr-4">
                      <ul className="space-y-3">
                        {aiSuggestions.map(suggestion => (
                          <li key={suggestion.id!} className="p-3 border rounded-md bg-muted/50 dark:bg-muted/20 space-y-2">
                            <p className="text-sm">{suggestion.suggestionText}</p>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">{formatTimestamp(suggestion.timestamp)}</span>
                              {suggestion.status === 'pending' ? (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="h-7 px-2 py-1 text-xs border-green-500 text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-800" onClick={() => handleSuggestionAction(suggestion.id!, 'approved')} disabled={!dbAvailable}>
                                    <Check className="h-3 w-3 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 py-1 text-xs border-red-500 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-800" onClick={() => handleSuggestionAction(suggestion.id!, 'rejected')} disabled={!dbAvailable}>
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
              </Card>
            </div>

            {/* Chat Column */}
            <div className="lg:col-span-1 flex flex-col">
              <Card className="flex-grow flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Chat with Patient</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow overflow-hidden flex flex-col p-0">
                  <ScrollArea className="flex-grow p-4">
                     {/* Show loader if patient details loading and no messages yet */}
                    {(loadingPatientDetails && !chatMessages.length) ? (
                       <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                    ) : chatMessages.length > 0 ? (
                      <div className="space-y-4">
                        {chatMessages.map(msg => (
                          <div key={msg.id!} className={`flex ${msg.senderId === PLACEHOLDER_DOCTOR_ID ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-2 rounded-lg max-w-[75%] ${msg.senderId === PLACEHOLDER_DOCTOR_ID ? 'bg-primary text-primary-foreground' : 'bg-muted dark:bg-muted/40'}`}>
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
                      disabled={sendingMessage || !dbAvailable}
                    />
                    <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim() || !dbAvailable} size="icon">
                      {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : selectedPatientId && !coreDataLoading && dbAvailable ? ( // Show if patient selected, not loading, but data is missing (implies an error during fetch)
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Patient Data</AlertTitle>
            <AlertDescription>{error || "Could not load data for the selected patient. Please try again or select a different patient."}</AlertDescription>
          </Alert>
        ) : null 
      )}

      {!selectedPatientId && dbAvailable && ( // Shown if no patient selected, and DB connection is fine (and not loading patients)
        !loadingPatients && 
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Select a patient to view details.</p>
          </CardContent>
        </Card>
      )}
       {!selectedPatientId && !dbAvailable && !loadingPatients && ( // Shown if no patient selected and DB is unavailable (and not loading patients)
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Patient selection unavailable. Database connection issue.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

    