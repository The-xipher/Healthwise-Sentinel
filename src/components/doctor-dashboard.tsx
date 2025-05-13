'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle, Users, Stethoscope, Activity, HeartPulse, Pill, MessageSquare, Send, Check, X, Info, Brain } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { summarizePatientHistory } from '@/ai/flows/summarize-patient-history';
import { generateCarePlan } from '@/ai/flows/generate-care-plan';
import { useToast } from '@/hooks/use-toast';
import { 
  fetchDoctorPatientsAction, 
  fetchDoctorPatientDetailsAction,
  sendChatMessageAction,
  updateSuggestionStatusAction,
  type DoctorPatient,
  type DoctorPatientHealthData,
  type DoctorPatientMedication,
  type DoctorChatMessage,
  type DoctorAISuggestion
} from '@/app/actions/doctorActions'; 

interface DoctorDashboardProps {
  doctorId: string;
  doctorName: string;
  userRole: 'doctor' | 'admin';
}

export default function DoctorDashboard({ doctorId, doctorName, userRole }: DoctorDashboardProps) {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientData, setSelectedPatientData] = useState<DoctorPatient | null>(null);
  const [patientHealthData, setPatientHealthData] = useState<DoctorPatientHealthData[]>([]);
  const [patientMedications, setPatientMedications] = useState<DoctorPatientMedication[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<DoctorAISuggestion[]>([]);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(true);
  const [loadingPatientDetails, setLoadingPatientDetails] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<DoctorChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [historySummary, setHistorySummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [carePlan, setCarePlan] = useState<string | null>(null);
  const [loadingCarePlan, setLoadingCarePlan] = useState<boolean>(false);
  const { toast } = useToast();
  const [dbAvailable, setDbAvailable] = useState<boolean>(true);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!doctorId) {
      setError("Doctor ID is missing. Cannot load dashboard.");
      setLoadingPatients(false);
      setDbAvailable(false);
      return;
    }
    async function loadInitialData() {
      setLoadingPatients(true);
      setError(null);
      try {
        const result = await fetchDoctorPatientsAction(doctorId);
        if (result.error) {
          setError(result.error);
          if (result.error.toLowerCase().includes("database connection") || 
              result.error.toLowerCase().includes("timeout") ||
              result.error.toLowerCase().includes("failed to connect") ||
              result.error.toLowerCase().includes("could not load patient list")) { // Broader check for connection issues
            setDbAvailable(false);
          }
          setPatients([]);
        } else {
          setPatients(result.patients || []);
          setDbAvailable(true); // Explicitly set true on success
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred while fetching patients.');
        setDbAvailable(false);
        setPatients([]);
        console.error("Error fetching doctor's patients:", e);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadInitialData();
  }, [doctorId]);

  useEffect(() => {
    if (!selectedPatientId || !doctorId) {
      setSelectedPatientData(null);
      setPatientHealthData([]);
      setPatientMedications([]);
      setAiSuggestions([]);
      setChatMessages([]);
      setHistorySummary(null);
      setCarePlan(null);
      setLoadingPatientDetails(false); 
      return;
    }

    async function fetchPatientAllData() {
      setLoadingPatientDetails(true);
      setError(null); 
      setHistorySummary(null); 
      setCarePlan(null);

      try {
        const result = await fetchDoctorPatientDetailsAction(selectedPatientId, doctorId);
        if (result.error) {
          setError(result.error);
           if (result.error.toLowerCase().includes("database connection") || 
               result.error.toLowerCase().includes("timeout") ||
               result.error.toLowerCase().includes("failed to connect") ||
               result.error.toLowerCase().includes("could not load patient data")) { // Broader check
            setDbAvailable(false); 
          }
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
          setDbAvailable(true); // Explicitly set true on success

          if (result.patient) {
            setLoadingSummary(true);
            try {
              const summaryResult = await summarizePatientHistory({
                patientId: selectedPatientId, 
                medicalHistory: result.patient.medicalHistory || "No detailed medical history available."
              });
              setHistorySummary(summaryResult.summary);
            } catch (aiError: any) { 
              console.error("AI Patient Summary Error:", aiError); 
              setHistorySummary("Could not generate AI summary: " + (aiError.message || "Service error")); 
            } finally { 
              setLoadingSummary(false); 
            }

            setLoadingCarePlan(true);
            try {
                const currentMedsString = (result.medications || []).map(m => `${m.name} (${m.dosage})`).join(', ') || "None listed";
                const predictedRisksString = result.patient?.readmissionRisk ? `Readmission Risk: ${result.patient.readmissionRisk}` : "No specific risks predicted by system.";
                const carePlanResult = await generateCarePlan({
                  patientId: selectedPatientId, 
                  predictedRisks: predictedRisksString,
                  medicalHistory: result.patient.medicalHistory || "No detailed medical history available.",
                  currentMedications: currentMedsString
                });
                setCarePlan(carePlanResult.carePlan);
            } catch (aiError: any) { 
              console.error("AI Care Plan Error:", aiError); 
              setCarePlan("Could not generate AI care plan: " + (aiError.message || "Service error"));
            } finally { 
              setLoadingCarePlan(false); 
            }
          }
        }
      } catch (e: any) {
        setError(e.message || "An unexpected error occurred fetching patient details.");
        setDbAvailable(false);
        console.error("Error fetching patient details:", e);
      } finally {
        setLoadingPatientDetails(false);
      }
    }

    fetchPatientAllData();
  }, [selectedPatientId, doctorId]); 

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      chatScrollAreaRef.current.scrollTop = chatScrollAreaRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPatientId || !doctorId) {
      toast({ title: "Cannot Send", description: "Message is empty or no patient/doctor selected.", variant: "destructive" });
      return;
    }
    if (!dbAvailable) {
      toast({ title: "Message Failed", description: "Database not available.", variant: "destructive" });
      return;
    }
    setSendingMessage(true);
    try {
      const result = await sendChatMessageAction(doctorId, doctorName, selectedPatientId, newMessage);
      if (result.error) {
        toast({ title: "Message Failed", description: result.error, variant: "destructive" });
      } else if (result.message) {
        setChatMessages(prev => [...prev, result.message!]);
        setNewMessage('');
        toast({ title: "Message Sent", variant: "default" });
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast({ title: "Message Failed", description: "Could not send message. " + (err.message || ''), variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSuggestionAction = async (suggestionIdStr: string, status: 'approved' | 'rejected') => {
    if (!selectedPatientId) {
      toast({ title: "Action Failed", description: "No patient selected.", variant: "destructive" });
      return;
    }
     if (!dbAvailable) {
      toast({ title: "Action Failed", description: "Database not available.", variant: "destructive" });
      return;
    }
    try {
      const result = await updateSuggestionStatusAction(suggestionIdStr, selectedPatientId, status);
      if (result.error) {
        toast({ title: "Update Failed", description: result.error, variant: "destructive" });
      } else if (result.updatedSuggestion) {
        setAiSuggestions(prev => prev.map(s => s.id === suggestionIdStr ? { ...s, status: status } : s));
        toast({
          title: `Suggestion ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          description: `The AI suggestion status has been updated.`,
        });
      }
    } catch (err: any) {
      console.error(`Error ${status}ing suggestion:`, err);
      toast({ title: "Update Failed", description: `Could not ${status} the suggestion. ` + (err.message || ''), variant: "destructive" });
    }
  };

  const formatTimestamp = (timestamp: Date | string | undefined): string => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return String(timestamp); 
    }
  };
  
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const coreDataLoading = loadingPatientDetails && selectedPatientId; 

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
        <Stethoscope className="h-8 w-8" /> 
        {userRole === 'admin' ? `Doctor View (Admin: ${doctorName})` : `${doctorName}'s Dashboard`}
      </h1>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!dbAvailable && !loadingPatients && !loadingPatientDetails && ( 
        <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>Database Disconnected</AlertTitle>
          <AlertDescription>
            Critical database features are currently offline. Patient data cannot be loaded or updated.
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Select Patient
          </CardTitle>
          <CardDescription>Choose a patient to view their details, manage care, and interact.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPatients ? (
            <Skeleton className="h-10 w-full md:w-[300px]" />
          ) : (
            <Select
              onValueChange={(value) => setSelectedPatientId(value)}
              value={selectedPatientId || ''}
              disabled={!dbAvailable || patients.length === 0}
            >
              <SelectTrigger className="w-full md:w-[350px] text-base py-3">
                <SelectValue placeholder={!dbAvailable ? "Patient list unavailable (DB offline)" : (patients.length === 0 ? "No patients assigned" : "Select a patient...")} />
              </SelectTrigger>
              <SelectContent>
                {patients.length > 0 ? (
                  patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={patient.photoURL || undefined} alt={patient.name} data-ai-hint="profile person" />
                          <AvatarFallback>{getInitials(patient.name)}</AvatarFallback>
                        </Avatar>
                        <span>{patient.name}</span>
                        {patient.readmissionRisk && (
                          <Badge 
                            variant={patient.readmissionRisk === 'high' ? 'destructive' : patient.readmissionRisk === 'medium' ? 'secondary' : 'default'} 
                            className="ml-auto text-xs px-2 py-0.5"
                          >
                            {patient.readmissionRisk} risk
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {dbAvailable ? "No patients currently assigned to you." : "Patient data is unavailable due to connection issues."}
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {coreDataLoading ? ( 
          <DashboardSkeleton />
      ) : selectedPatientId && dbAvailable && selectedPatientData ? ( 
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Patient Info Column */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-md">
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <Avatar className="h-16 w-16 border-2 border-primary">
                    <AvatarImage src={selectedPatientData?.photoURL || undefined} alt={selectedPatientData?.name} data-ai-hint="profile person" />
                    <AvatarFallback className="text-xl">{getInitials(selectedPatientData?.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">{selectedPatientData?.name}</CardTitle>
                    <CardDescription className="text-sm">{selectedPatientData?.email || 'No email'}</CardDescription>
                    {selectedPatientData?.readmissionRisk && (
                      <Badge variant={selectedPatientData.readmissionRisk === 'high' ? 'destructive' : selectedPatientData.readmissionRisk === 'medium' ? 'secondary' : 'default'} className="mt-2 text-xs px-2 py-0.5">
                        {selectedPatientData.readmissionRisk} readmission risk
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground pt-0">
                  <p>Patient ID: {selectedPatientData?.id}</p>
                  {selectedPatientData?.lastActivity && <p>Last Activity: {formatTimestamp(selectedPatientData.lastActivity)}</p>}
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5 text-primary"/>AI Patient Summary</CardTitle>
                  <CardDescription className="text-xs">Key points from the patient's history.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSummary ? (
                    <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-3/4" /></div>
                  ) : (
                    <ScrollArea className="h-[120px] pr-3">
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{historySummary || "No summary available."}</p>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5 text-primary"/>AI Generated Care Plan</CardTitle>
                  <CardDescription className="text-xs">Initial draft based on patient data.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCarePlan ? (
                    <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
                  ) : (
                     <ScrollArea className="h-[150px] pr-3">
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{carePlan || "No care plan generated yet."}</p>
                    </ScrollArea>
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
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Recent Health Data</CardTitle>
                </CardHeader>
                <CardContent>
                  {patientHealthData.length > 0 ? (
                    <ScrollArea className="h-[180px] pr-3">
                    <ul className="space-y-2 text-sm">
                      {patientHealthData.slice(0, 7).map((data) => (
                        <li key={data.id} className="flex justify-between items-center border-b pb-1.5 pt-1">
                          <span className="text-xs">{formatTimestamp(data.timestamp)}</span>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {data.steps !== undefined && <span className="flex items-center"><Activity className="h-3 w-3 mr-1" />{data.steps}</span>}
                            {data.heartRate !== undefined && <span className="flex items-center"><HeartPulse className="h-3 w-3 mr-1 text-red-500" />{data.heartRate} bpm</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No recent health data.</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="link" size="sm" disabled={!dbAvailable} className="text-primary">View All Health Data</Button>
                </CardFooter>
              </Card>

              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Pill className="h-5 w-5 text-primary" /> Medication Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  {patientMedications.length > 0 ? (
                    <ScrollArea className="h-[180px] pr-3">
                    <ul className="space-y-3 text-sm">
                      {patientMedications.map(med => (
                        <li key={med.id} className="border-b pb-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{med.name} <span className="text-xs text-muted-foreground">({med.dosage})</span></span>
                            <Badge variant={med.adherence && med.adherence >= 90 ? 'default' : med.adherence && med.adherence >= 70 ? 'secondary' : 'destructive'} className="text-xs px-2 py-0.5">
                              {med.adherence !== undefined ? `${med.adherence}% adherence` : 'N/A'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{med.frequency}</p>
                        </li>
                      ))}
                    </ul>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No medications assigned.</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="link" size="sm" disabled={!dbAvailable} className="text-primary">Manage Medications</Button>
                </CardFooter>
              </Card>

               <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> AI Suggested Interventions</CardTitle>
                  <CardDescription className="text-xs">Review and act on AI-driven suggestions.</CardDescription>
                </CardHeader>
                <CardContent>
                  {(loadingPatientDetails && !aiSuggestions.length) ? ( 
                    <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : aiSuggestions.length > 0 ? (
                    <ScrollArea className="h-[200px] pr-3">
                      <ul className="space-y-3">
                        {aiSuggestions.map(suggestion => (
                          <li key={suggestion.id} className="p-3 border rounded-md bg-card hover:shadow-sm transition-shadow space-y-2">
                            <p className="text-sm">{suggestion.suggestionText}</p>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">{formatTimestamp(suggestion.timestamp)}</span>
                              {suggestion.status === 'pending' ? (
                                <div className="flex gap-2">
                                  <Button size="xs" variant="outline" className="h-7 px-2 py-1 text-xs border-green-500 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-700 dark:hover:text-green-200" onClick={() => handleSuggestionAction(suggestion.id, 'approved')} disabled={!dbAvailable}>
                                    <Check className="h-3 w-3 mr-1" /> Approve
                                  </Button>
                                  <Button size="xs" variant="outline" className="h-7 px-2 py-1 text-xs border-red-500 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-700 dark:hover:text-red-200" onClick={() => handleSuggestionAction(suggestion.id, 'rejected')} disabled={!dbAvailable}>
                                    <X className="h-3 w-3 mr-1" /> Reject
                                  </Button>
                                </div>
                              ) : (
                                <Badge variant={suggestion.status === 'approved' ? 'default' : 'destructive'} className="text-xs capitalize px-2 py-0.5">
                                  {suggestion.status}
                                </Badge>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No AI suggestions available for this patient.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Chat Column */}
            <div className="lg:col-span-1 flex flex-col">
              <Card className="flex-grow flex flex-col shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" /> Chat with {selectedPatientData?.name || 'Patient'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow overflow-hidden flex flex-col p-0">
                  <ScrollArea className="flex-grow p-4 bg-muted/20 dark:bg-muted/10" ref={chatScrollAreaRef}>
                    {(loadingPatientDetails && !chatMessages.length) ? (
                       <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
                    ) : chatMessages.length > 0 ? (
                      <div className="space-y-4">
                        {chatMessages.map(msg => (
                          <div key={msg.id} className={`flex ${msg.senderId === doctorId ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-xl max-w-[80%] shadow-sm ${msg.senderId === doctorId ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border'}`}>
                              <p className="text-sm">{msg.text}</p>
                              <p className={`text-xs mt-1 ${msg.senderId === doctorId ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left'}`}>
                                {msg.senderName} - {formatTimestamp(msg.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">No messages in this chat yet.</p>
                    )}
                  </ScrollArea>
                </CardContent>
                <CardFooter className="p-4 border-t bg-card">
                  <div className="flex w-full items-center gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-grow resize-none min-h-[40px] h-10 text-sm border-input focus:ring-primary"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sendingMessage || !dbAvailable}
                      rows={1}
                    />
                    <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim() || !dbAvailable} size="icon" className="shrink-0">
                      {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                       <span className="sr-only">Send message</span>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : selectedPatientId && !coreDataLoading && dbAvailable ? ( 
          <Alert variant="default" className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900 dark:border-orange-700 dark:text-orange-200">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertTitle>Patient Data Not Found</AlertTitle>
            <AlertDescription>{error || "Could not load data for the selected patient. They might not have any records or an error occurred. Please try again or select a different patient."}</AlertDescription>
          </Alert>
        ) : null
      }

      {!selectedPatientId && dbAvailable && !loadingPatients && ( 
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground text-lg">
              Please select a patient from the list above to view their details.
            </p>
          </CardContent>
        </Card>
      )}
       {!selectedPatientId && !dbAvailable && !loadingPatients && ( 
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground text-lg">Patient selection unavailable. Database connection may be down.</p>
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
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-1/3 mt-1" />
            </div>
          </CardHeader>
          <CardContent className="text-xs pt-0 space-y-1">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader><Skeleton className="h-6 w-3/5" /><Skeleton className="h-3 w-4/5 mt-1" /></CardHeader>
          <CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-3/4" /></CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader><Skeleton className="h-6 w-3/5" /><Skeleton className="h-3 w-4/5 mt-1" /></CardHeader>
          <CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></CardContent>
          <CardFooter><Skeleton className="h-8 w-24" /></CardFooter>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-6">
        <Card className="shadow-md">
          <CardHeader><Skeleton className="h-6 w-4/5" /></CardHeader>
          <CardContent className="space-y-2.5"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /></CardContent>
          <CardFooter><Skeleton className="h-6 w-28" /></CardFooter>
        </Card>
        <Card className="shadow-md">
          <CardHeader><Skeleton className="h-6 w-4/5" /></CardHeader>
          <CardContent className="space-y-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></CardContent>
          <CardFooter><Skeleton className="h-6 w-32" /></CardFooter>
        </Card>
        <Card className="shadow-md">
          <CardHeader><Skeleton className="h-6 w-4/5" /><Skeleton className="h-3 w-full mt-1" /></CardHeader>
          <CardContent><Skeleton className="h-24 w-full" /></CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1 flex flex-col">
        <Card className="flex-grow flex flex-col shadow-md">
          <CardHeader><Skeleton className="h-6 w-3/5" /></CardHeader>
          <CardContent className="flex-grow p-2"><Skeleton className="h-full w-full rounded-md" /></CardContent>
          <CardFooter className="p-2"><Skeleton className="h-10 w-full" /></CardFooter>
        </Card>
      </div>
    </div>
  );
}