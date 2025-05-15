
'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, Users, Stethoscope, Activity, HeartPulse, Pill, MessageSquare, Send, Check, X, Info, Brain, Search, CalendarDays, Sparkles, BookMarked, TrendingUp, ThumbsDown, Droplet } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { summarizePatientHistory } from '@/ai/flows/summarize-patient-history';
import { generateCarePlan } from '@/ai/flows/generate-care-plan';
import { analyzePatientHealthTrends, type AnalyzePatientHealthTrendsOutput, type AnalyzePatientHealthTrendsInput } from '@/ai/flows/analyze-patient-health-trends';
import { useToast } from '@/hooks/use-toast';
import {
  fetchDoctorPatientsAction,
  fetchDoctorPatientDetailsAction,
  sendChatMessageAction,
  updateSuggestionStatusAction,
  fetchDoctorAppointmentsAction,
  createAppointmentAction,
  type DoctorPatient,
  type DoctorPatientHealthData,
  type DoctorPatientMedication,
  type DoctorChatMessage,
  type DoctorAISuggestion,
  type Appointment
} from '@/app/actions/doctorActions';
import { markMessagesAsReadAction } from '@/app/actions/chatActions';
import { format, addDays, formatDistanceToNow } from 'date-fns';


interface DoctorDashboardProps {
  doctorId: string;
  doctorName: string;
  userRole: 'doctor' | 'admin';
}

const getChatId = (id1: string, id2: string): string => {
  if (!id1 || !id2) return "";
  return [id1, id2].sort().join('_');
};

const formatBoldMarkdown = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
};

function DoctorDashboardContent({ doctorId, doctorName, userRole }: DoctorDashboardProps) {
  const searchParams = useSearchParams();
  const patientIdFromQuery = searchParams.get('patientId');

  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patientIdFromQuery);
  const [selectedPatientData, setSelectedPatientData] = useState<DoctorPatient | null>(null);
  const [patientHealthData, setPatientHealthData] = useState<DoctorPatientHealthData[]>([]);
  const [patientMedications, setPatientMedications] = useState<DoctorPatientMedication[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<DoctorAISuggestion[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true);

  const [trendAnalysis, setTrendAnalysis] = useState<AnalyzePatientHealthTrendsOutput | null>(null);
  const [loadingTrendAnalysis, setLoadingTrendAnalysis] = useState<boolean>(false);

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
  const [isChatOpen, setIsChatOpen] = useState(false);


  useEffect(() => {
    const queryPatientId = searchParams.get('patientId');
    if (queryPatientId && queryPatientId !== selectedPatientId) {
      setSelectedPatientId(queryPatientId);
    }
  }, [searchParams, selectedPatientId]);

  const refreshAppointments = async () => {
    if (!doctorId) return;
    setLoadingAppointments(true);
    try {
        const appointmentsResult = await fetchDoctorAppointmentsAction(doctorId);
        if (appointmentsResult.error) {
            setError(prev => prev ? `${prev}\nAppointments: ${appointmentsResult.error}` : `Appointments: ${appointmentsResult.error}`);
        } else {
            setAppointments(appointmentsResult.appointments || []);
        }
    } catch (e: any) {
        setError(prev => prev ? `${prev}\nAppointments: ${e.message}` : `Appointments: ${e.message}`);
    } finally {
        setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    if (!doctorId) {
      setError("Doctor ID is missing. Cannot load dashboard.");
      setLoadingPatients(false);
      setLoadingAppointments(false);
      setDbAvailable(false);
      return;
    }
    async function loadInitialDoctorData() {
      setLoadingPatients(true);
      setError(null);
      try {
        const patientsResultPromise = fetchDoctorPatientsAction(doctorId);
        await Promise.all([patientsResultPromise, refreshAppointments()]);
        const patientsResult = await patientsResultPromise;


        if (patientsResult.error) {
          setError(prev => prev ? `${prev}\n${patientsResult.error}` : patientsResult.error);
          if (patientsResult.error.toLowerCase().includes("database connection") ||
              patientsResult.error.toLowerCase().includes("timeout") ||
              patientsResult.error.toLowerCase().includes("failed to connect") ||
              patientsResult.error.toLowerCase().includes("could not load patient list")) {
            setDbAvailable(false);
          }
          setPatients([]);
        } else {
          setPatients(patientsResult.patients || []);
          setDbAvailable(true);
        }

      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred while fetching initial doctor data.');
        setDbAvailable(false);
        setPatients([]);
        setAppointments([]); 
        console.error("Error fetching initial doctor data:", e);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadInitialDoctorData();
  }, [doctorId, patientIdFromQuery]); 

  const prepareTrendAnalysisInput = (
    patient: DoctorPatient,
    healthData: DoctorPatientHealthData[],
    medications: DoctorPatientMedication[]
  ): AnalyzePatientHealthTrendsInput => {
    const recentHealth = healthData.slice(-5).reverse(); 
    const healthSummary = recentHealth.length > 0
      ? "Recent Vitals (last " + recentHealth.length + " entries, newest first):\n" + recentHealth.map(d =>
          `- ${new Date(d.timestamp).toLocaleDateString()}: BP: ${d.heartRate && d.steps ? (Math.round(Number(d.heartRate) * 1.6 + Number(d.steps)/200)) + '/' + (Math.round(Number(d.heartRate) * 0.9 + Number(d.steps)/300)) : 'N/A'}, HR: ${d.heartRate ?? 'N/A'}bpm, Glucose: ${d.bloodGlucose ?? 'N/A'}mg/dL, Steps: ${d.steps ?? 'N/A'}`
        ).join("\n")
      : "No recent vital signs logged.";

    const adherenceSummary = medications.length > 0
      ? "Medication Adherence:\n" + medications.map(m =>
          `- ${m.name} (${m.dosage}): ${m.adherence ?? 'N/A'}%`
        ).join("\n")
      : "No medications listed or adherence not tracked.";

    const riskProfile = `Patient Readmission Risk: ${patient.readmissionRisk || 'N/A'}. Medical History: ${patient.medicalHistory || 'Not specified.'}`;

    return {
      patientId: patient.id,
      recentHealthDataSummary: healthSummary,
      medicationAdherenceSummary: adherenceSummary,
      patientRiskProfile: riskProfile,
    };
  };

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
      setTrendAnalysis(null);
      setLoadingTrendAnalysis(false);
      if(isChatOpen && selectedPatientId !== selectedPatientData?.id) setIsChatOpen(false);
      return;
    }

    async function fetchPatientAllData() {
      setLoadingPatientDetails(true);
      setLoadingTrendAnalysis(true); 
      setHistorySummary("Loading AI Summary...");
      setCarePlan("Loading AI Care Plan...");
      setTrendAnalysis(null); 


      try {
        const result = await fetchDoctorPatientDetailsAction(selectedPatientId, doctorId);
        if (result.error) {
          setError(prev => prev ? `${prev}\nPatient Details: ${result.error}` : `Patient Details: ${result.error}`);
           if (result.error.toLowerCase().includes("database connection") ||
               result.error.toLowerCase().includes("timeout") ||
               result.error.toLowerCase().includes("failed to connect") ||
               result.error.toLowerCase().includes("could not load patient data")) {
            setDbAvailable(false);
          }
          setSelectedPatientData(null);
          setPatientHealthData([]);
          setPatientMedications([]);
          setAiSuggestions([]);
          setChatMessages([]);
          setHistorySummary("Could not load AI summary due to data error.");
          setCarePlan("Could not load AI care plan due to data error.");
          setTrendAnalysis({ isTrendConcerning: false, trendSummary: "Could not perform trend analysis due to data error.", suggestedActionForDoctor: null });
        } else {
          setSelectedPatientData(result.patient || null);
          setPatientHealthData(result.healthData || []);
          setPatientMedications(result.medications || []);
          setAiSuggestions(result.aiSuggestions || []);
          setChatMessages(result.chatMessages || []);

          if (result.patient) {
            const currentChatId = getChatId(doctorId, selectedPatientId);
            await markMessagesAsReadAction(currentChatId, doctorId);

            setLoadingSummary(true);
            try {
              const summaryResult = await summarizePatientHistory({
                patientId: selectedPatientId,
                medicalHistory: result.patient.medicalHistory || "No detailed medical history available."
              });
              setHistorySummary(summaryResult.summary);
            } catch (aiError: any) {
              console.error("AI Patient Summary Error:", aiError);
              const errorMsg = aiError.message?.includes("NOT_FOUND") || aiError.message?.includes("API key") || aiError.message?.includes("model") ? "Model not found or API key issue." : "Service error.";
              setHistorySummary("Could not generate AI summary. " + errorMsg);
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
              const errorMsg = aiError.message?.includes("NOT_FOUND") || aiError.message?.includes("API key") || aiError.message?.includes("model") ? "Model not found or API key issue." : "Service error.";
              setCarePlan("Could not generate AI care plan. " + errorMsg);
            } finally {
              setLoadingCarePlan(false);
            }

            if (result.patient && result.healthData && result.medications) {
              setLoadingTrendAnalysis(true); 
              const trendInput = prepareTrendAnalysisInput(result.patient, result.healthData, result.medications);
              try {
                const trendOutput = await analyzePatientHealthTrends(trendInput);
                setTrendAnalysis(trendOutput);
              } catch (aiError: any) {
                 console.error("AI Trend Analysis Error:", aiError);
                 const errorMsg = aiError.message?.includes("NOT_FOUND") || aiError.message?.includes("API key") || aiError.message?.includes("model") ? "Model not found or API key issue." : "Service error.";
                 setTrendAnalysis({ isTrendConcerning: false, trendSummary: "Could not perform AI trend analysis. " + errorMsg, suggestedActionForDoctor: null });
              } finally {
                 setLoadingTrendAnalysis(false);
              }
            } else {
               setTrendAnalysis({ isTrendConcerning: false, trendSummary: "Insufficient data for trend analysis.", suggestedActionForDoctor: null });
               setLoadingTrendAnalysis(false);
            }
          }
        }
      } catch (e: any) {
        setError(e.message || "An unexpected error occurred fetching patient details.");
        setHistorySummary("Error fetching patient data for AI summary.");
        setCarePlan("Error fetching patient data for AI care plan.");
        setTrendAnalysis({ isTrendConcerning: false, trendSummary: "Error fetching patient data for trend analysis.", suggestedActionForDoctor: null });
        console.error("Error fetching patient details:", e);
      } finally {
        setLoadingPatientDetails(false);
      }
    }

    fetchPatientAllData();
  }, [selectedPatientId, doctorId, doctorName, toast]); 

  useEffect(() => {
    if (isChatOpen && chatScrollAreaRef.current) {
       setTimeout(() => {
         if (chatScrollAreaRef.current) {
            chatScrollAreaRef.current.scrollTop = chatScrollAreaRef.current.scrollHeight;
         }
      }, 0);
    }
  }, [chatMessages, isChatOpen]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery) {
      return patients;
    }
    return patients.filter(patient =>
      (patient.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [patients, searchQuery]);

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
    const currentDoctorId = doctorId; 
    try {
      const result = await sendChatMessageAction(currentDoctorId, doctorName, selectedPatientId, newMessage);
      if (result.error) {
        toast({ title: "Message Failed", description: result.error, variant: "destructive" });
      } else if (result.message) {
        setChatMessages(prev => [...prev, result.message!]);
        setNewMessage('');
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

  const formatDateOnly = (dateString: string | Date): string => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'PPP');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTimeOnly = (dateString: string | Date): string => {
     if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'p');
    } catch {
      return 'Invalid Time';
    }
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const names = (name || "").split(' ');
    if (names.length === 1) return names[0][0]?.toUpperCase() || '?';
    return ((names[0][0] || '') + (names[names.length - 1][0] || '')).toUpperCase();
  };

  const getRiskBadgeVariant = (risk?: 'low' | 'medium' | 'high'): 'default' | 'secondary' | 'destructive' => {
    if (risk === 'high') return 'destructive';
    if (risk === 'medium') return 'secondary';
    return 'default';
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
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      {!dbAvailable && !loadingPatients && !loadingPatientDetails && !loadingAppointments && !loadingTrendAnalysis && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>Database Disconnected</AlertTitle>
          <AlertDescription>
            Critical database features are currently offline. Patient data cannot be loaded or updated.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4"> 
        <div className="lg:col-span-1 space-y-4"> 
            <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" /> Patient List
                </CardTitle>
                <CardDescription className="text-xs">Search and select a patient.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    type="search"
                    placeholder="Search patient by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full text-sm py-2 h-10"
                    disabled={loadingPatients || !dbAvailable}
                    />
                </div>
                {loadingPatients ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <Select
                    onValueChange={(value) => setSelectedPatientId(value)}
                    value={selectedPatientId || ''}
                    disabled={!dbAvailable || patients.length === 0}
                    >
                    <SelectTrigger className="w-full text-sm py-2 h-10">
                        <SelectValue placeholder={!dbAvailable ? "Patient list unavailable (DB offline)" : (patients.length === 0 ? "No patients assigned" : (filteredPatients.length === 0 && searchQuery ? "No patients match search" : "Select a patient..."))} />
                    </SelectTrigger>
                    <SelectContent>
                        {filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => {
                            const patientName = patient.name;
                            return (
                            <SelectItem key={patient.id} value={patient.id}>
                                <div className="flex items-center justify-between w-full gap-3">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                    <AvatarImage src={patient.photoURL || undefined} alt={patientName} data-ai-hint="profile person"/>
                                    <AvatarFallback>{getInitials(patientName)}</AvatarFallback>
                                    </Avatar>
                                     <span>{patientName} ({patient.id?.substring(0,6)})</span>
                                </div>
                                {patient.readmissionRisk && (
                                    <Badge
                                    variant={getRiskBadgeVariant(patient.readmissionRisk)}
                                    className="ml-auto text-xs px-1.5 py-0.5 capitalize"
                                    >
                                    {patient.readmissionRisk} risk
                                    </Badge>
                                )}
                                </div>
                            </SelectItem>
                            );
                        })
                        ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            {dbAvailable ? (searchQuery ? "No patients match your search." : "No patients currently assigned to you.") : "Patient data is unavailable."}
                        </div>
                        )}
                    </SelectContent>
                    </Select>
                )}
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/> Upcoming Appointments</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                    {loadingAppointments ? (
                         <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : appointments.length > 0 ? (
                        <ScrollArea className="h-[200px] pr-2">
                            <ul className="space-y-3">
                                {appointments.map(appt => (
                                    <li key={appt.id} className="p-3 border rounded-md bg-card hover:shadow-sm transition-shadow space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-sm">{appt.patientName}</span>
                                            <Badge variant="outline" className="text-xs">{formatTimeOnly(appt.appointmentDate)}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{formatDateOnly(appt.appointmentDate)}</p>
                                        <p className="text-xs text-muted-foreground">Reason: {appt.reason}</p>
                                         <Button variant="link" size="xs" className="p-0 h-auto text-primary" onClick={() => setSelectedPatientId(appt.patientId)}>View Patient</Button>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No upcoming appointments scheduled.</p>
                    )}
                </CardContent>
            </Card>
        </div>

        {coreDataLoading ? (
            <DashboardSkeletonCentralColumns />
        ) : selectedPatientId && dbAvailable && selectedPatientData ? (
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start"> 
                <Card className="shadow-md md:col-span-1 xl:col-span-1">
                  <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2"> 
                    <Avatar className="h-12 w-12 border-2 border-primary"> 
                      <AvatarImage src={selectedPatientData?.photoURL || undefined} alt={selectedPatientData?.name} data-ai-hint="profile person"/>
                      <AvatarFallback className="text-base">{getInitials(selectedPatientData?.name)}</AvatarFallback> 
                    </Avatar>
                    <div>
                      <CardTitle className="text-md">{selectedPatientData?.name}</CardTitle> 
                      <CardDescription className="text-xs">{selectedPatientData?.email || 'No email'}</CardDescription> 
                      {selectedPatientData?.readmissionRisk && (
                        <Badge variant={getRiskBadgeVariant(selectedPatientData.readmissionRisk)} className="mt-1 text-xs px-1.5 py-0.5 capitalize"> 
                          {selectedPatientData.readmissionRisk} readmission risk
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground px-4 pt-0 pb-3"> 
                    <p>Patient ID: {selectedPatientData?.id.substring(0,8)}...</p>
                    {selectedPatientData?.lastActivity && <p>Last Activity: {formatDistanceToNow(new Date(selectedPatientData.lastActivity), { addSuffix: true })}</p>}
                  </CardContent>
                </Card>

                <Card className="shadow-md md:col-span-1 xl:col-span-1">
                  <CardHeader className="p-4 pb-2"> 
                    <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-primary"/>AI Patient Summary</CardTitle> 
                    <CardDescription className="text-xs">Key points from history.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pt-1 pb-3"> 
                    {loadingSummary ? (
                      <div className="space-y-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-3/4" /></div>
                    ) : (
                      <ScrollArea className="h-[80px] pr-2">
                        <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatBoldMarkdown(historySummary) }} />
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-md md:col-span-2 xl:col-span-1">
                  <CardHeader className="p-4 pb-2"> 
                    <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-primary"/>AI Generated Care Plan</CardTitle> 
                    <CardDescription className="text-xs">Initial draft based on data.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pt-1 pb-2"> 
                    {loadingCarePlan ? (
                      <div className="space-y-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div>
                    ) : (
                       <ScrollArea className="h-[80px] pr-2"> 
                        <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatBoldMarkdown(carePlan) }} />
                      </ScrollArea>
                    )}
                  </CardContent>
                  <CardFooter className="p-3 pt-1"> 
                    <Button size="sm" variant="outline" disabled={loadingCarePlan || !dbAvailable} className="h-7 text-xs px-2"> 
                      Edit/Approve Plan
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="shadow-md md:col-span-1 xl:col-span-1">
                  <CardHeader className="p-4 pb-2"> 
                    <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Health Data</CardTitle> 
                  </CardHeader>
                  <CardContent className="px-4 pt-1 pb-2"> 
                    {patientHealthData.length > 0 ? (
                      <ScrollArea className="h-[180px] pr-2"> 
                      <ul className="space-y-1.5 text-xs"> 
                        {patientHealthData.slice(-10).reverse().map((data) => ( // Show last 10
                          <li key={data.id} className="flex justify-between items-center border-b pb-1 pt-0.5 text-xs"> 
                            <span className="text-muted-foreground">{formatDistanceToNow(new Date(data.timestamp), { addSuffix: true })}</span>
                            <div className="flex gap-1.5"> 
                              {data.steps !== undefined && <span className="flex items-center"><Activity className="h-3 w-3 mr-0.5" />{data.steps}</span>}
                              {data.heartRate !== undefined && <span className="flex items-center"><HeartPulse className="h-3 w-3 mr-0.5 text-red-500" />{data.heartRate} bpm</span>}
                               {data.bloodGlucose !== undefined && <span className="flex items-center"><Droplet className="h-3 w-3 mr-0.5 text-blue-500" />{data.bloodGlucose} mg/dL</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                      </ScrollArea>
                    ) : (
                      <p className="text-xs text-muted-foreground py-3 text-center">No recent health data.</p> 
                    )}
                  </CardContent>
                  <CardFooter className="p-3 pt-1"> 
                    <Button variant="link" size="xs" disabled={!dbAvailable} className="text-primary p-0 h-auto text-xs">View All Health Data</Button>
                  </CardFooter>
                </Card>

                <Card className="shadow-md md:col-span-1 xl:col-span-1">
                  <CardHeader className="p-4 pb-2"> 
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> AI Health Trend Analysis
                    </CardTitle> 
                    <CardDescription className="text-xs">Proactive analysis of data.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pt-1 pb-2 min-h-[100px]"> 
                    {loadingTrendAnalysis ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                         <Skeleton className="h-7 w-1/2 mt-1.5" /> 
                      </div>
                    ) : trendAnalysis ? (
                      trendAnalysis.isTrendConcerning ? (
                        <div className="space-y-1.5">
                          <Alert variant="destructive" className="p-2 text-xs"> 
                             <AlertTriangle className="h-3 w-3"/>
                             <AlertTitle className="text-xs font-semibold">Concerning Trend!</AlertTitle>
                             <AlertDescription className="text-xs leading-tight">{trendAnalysis.trendSummary || "A concerning trend was noted."}</AlertDescription>
                          </Alert>
                          {trendAnalysis.suggestedActionForDoctor && (
                            <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-900/30 dark:border-amber-700"> 
                              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Suggested Action:</p>
                              <p className="text-xs text-amber-600 dark:text-amber-400 leading-tight">{trendAnalysis.suggestedActionForDoctor}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center h-full py-2">
                          <ThumbsDown className="h-5 w-5 text-green-500 mb-1" /> 
                          <p className="text-xs text-muted-foreground">{trendAnalysis.trendSummary || "No concerning health trends identified."}</p>
                        </div>
                      )
                    ) : (
                       dbAvailable && <p className="text-xs text-muted-foreground text-center py-3">Trend analysis not available.</p>
                    )}
                  </CardContent>
                  <CardFooter className="p-3 pt-1"> 
                      <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2" 
                          onClick={async () => {
                              if (!selectedPatientData || !patientHealthData || !patientMedications) return;
                              setLoadingTrendAnalysis(true);
                              const trendInput = prepareTrendAnalysisInput(selectedPatientData, patientHealthData, patientMedications);
                              try {
                                  const trendOutput = await analyzePatientHealthTrends(trendInput);
                                  setTrendAnalysis(trendOutput);
                              } catch (aiError: any) {
                                  console.error("AI Trend Analysis Error:", aiError);
                                  const errorMsg = aiError.message?.includes("NOT_FOUND") || aiError.message?.includes("API key") || aiError.message?.includes("model") ? "Model not found or API key issue." : "Service error.";
                                  setTrendAnalysis({ isTrendConcerning: false, trendSummary: "Could not re-run AI trend analysis. " + errorMsg, suggestedActionForDoctor: null });
                              } finally {
                                  setLoadingTrendAnalysis(false);
                              }
                          }}
                          disabled={loadingTrendAnalysis || !selectedPatientData || !dbAvailable}
                      >
                         {loadingTrendAnalysis ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> :  <Sparkles className="mr-1 h-3 w-3"/>} 
                          Re-analyze
                      </Button>
                  </CardFooter>
                </Card>

                <Card className="shadow-md md:col-span-1 xl:col-span-1">
                  <CardHeader className="p-4 pb-2"> 
                    <CardTitle className="text-sm flex items-center gap-2"><Pill className="h-4 w-4 text-primary" /> Medication Overview</CardTitle> 
                  </CardHeader>
                  <CardContent className="px-4 pt-1 pb-2"> 
                    {patientMedications.length > 0 ? (
                      <ScrollArea className="h-[180px] pr-2"> 
                      <ul className="space-y-1.5 text-xs"> 
                        {patientMedications.map(med => (
                          <li key={med.id} className="border-b pb-1.5"> 
                            <div className="flex justify-between items-center mb-0.5"> 
                              <span className="font-medium text-xs">{med.name} <span className="text-xs text-muted-foreground">({med.dosage})</span></span> 
                              <Badge variant={med.adherence && med.adherence >= 90 ? 'default' : med.adherence && med.adherence >= 70 ? 'secondary' : 'destructive'} className="text-xs px-1.5 py-0.5"> 
                                {med.adherence !== undefined ? `${med.adherence}% adherence` : 'N/A'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{med.frequency}</p>
                          </li>
                        ))}
                      </ul>
                      </ScrollArea>
                    ) : (
                      <p className="text-xs text-muted-foreground py-3 text-center">No medications assigned.</p>
                    )}
                  </CardContent>
                  <CardFooter className="p-3 pt-1"> 
                    <Button variant="link" size="xs" disabled={!dbAvailable} className="text-primary p-0 h-auto text-xs">Manage Medications</Button>
                  </CardFooter>
                </Card>

                 <Card className="shadow-md md:col-span-2 xl:col-span-3"> 
                  <CardHeader className="p-4 pb-2"> 
                    <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> AI Suggested Interventions</CardTitle> 
                    <CardDescription className="text-xs">Review and act on AI-driven suggestions.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pt-1 pb-2"> 
                    {(loadingPatientDetails && !aiSuggestions.length) ? (
                      <div className="flex items-center justify-center p-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : aiSuggestions.length > 0 ? (
                      <ScrollArea className="h-[150px] pr-2"> 
                        <ul className="space-y-1.5"> 
                          {aiSuggestions.map(suggestion => (
                            <li key={suggestion.id} className="p-2 border rounded-md bg-card hover:shadow-sm transition-shadow space-y-1"> 
                              <p className="text-xs" dangerouslySetInnerHTML={{ __html: formatBoldMarkdown(suggestion.suggestionText) }} />
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(suggestion.timestamp), { addSuffix: true })}</span>
                                {suggestion.status === 'pending' ? (
                                  <div className="flex gap-1"> 
                                    <Button size="xs" variant="outline" className="h-6 px-1.5 py-0.5 text-xs border-green-500 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-700 dark:hover:text-green-200" onClick={() => handleSuggestionAction(suggestion.id, 'approved')} disabled={!dbAvailable}>
                                      <Check className="h-3 w-3 mr-0.5" /> Approve
                                    </Button>
                                    <Button size="xs" variant="outline" className="h-6 px-1.5 py-0.5 text-xs border-red-500 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-700 dark:hover:text-red-200" onClick={() => handleSuggestionAction(suggestion.id, 'rejected')} disabled={!dbAvailable}>
                                      <X className="h-3 w-3 mr-0.5" /> Reject
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge variant={suggestion.status === 'approved' ? 'default' : 'destructive'} className="text-xs capitalize px-1.5 py-0.5"> 
                                    {suggestion.status}
                                  </Badge>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    ) : (
                      <p className="text-xs text-muted-foreground py-3 text-center">No AI suggestions available.</p>
                    )}
                  </CardContent>
                </Card>
            </div>
        ) : selectedPatientId && !coreDataLoading && dbAvailable ? (
             <div className="lg:col-span-3">
                <Alert variant="default" className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900 dark:border-orange-700 dark:text-orange-200 h-full flex flex-col justify-center items-center">
                    <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mb-2" />
                    <AlertTitle className="text-lg">Patient Data Not Found</AlertTitle>
                    <AlertDescription>{error || "Could not load data for the selected patient. They might not have any records or an error occurred. Please try again or select a different patient."}</AlertDescription>
                </Alert>
            </div>
        ) : !selectedPatientId && dbAvailable && !loadingPatients && (
            <div className="lg:col-span-3">
                <Card className="shadow-md h-full flex items-center justify-center">
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground text-lg">
                        Please {searchQuery ? "clear your search or " : ""}select a patient from the list to view their details.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )}
        {!selectedPatientId && !dbAvailable && !loadingPatients && (
            <div className="lg:col-span-3">
                <Card className="shadow-md h-full flex items-center justify-center">
                <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground text-lg">Patient selection unavailable. Database connection may be down.</p>
                </CardContent>
                </Card>
            </div>
        )}

      </div>

      {selectedPatientId && selectedPatientData && dbAvailable && (
        <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
            <SheetTrigger asChild>
                 <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-50 bg-primary text-primary-foreground hover:bg-primary/90"
                    aria-label="Open chat with patient"
                    onClick={() => setIsChatOpen(true)}
                >
                    <MessageSquare className="h-7 w-7" />
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[calc(100vw-2rem)] max-w-md md:w-[400px] flex flex-col p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" /> Chat with {selectedPatientData?.name || 'Patient'}
                    </SheetTitle>
                     <SheetClose onClick={() => setIsChatOpen(false)} />
                </SheetHeader>
                <ScrollArea className="flex-grow p-4 bg-muted/10" ref={chatScrollAreaRef}>
                    {(loadingPatientDetails && !chatMessages.length) ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
                    ) : chatMessages.length > 0 ? (
                    <div className="space-y-4">
                        {chatMessages.map(msg => {
                            const isDoctorMessage = msg.senderId === doctorId;
                            return (
                            <div key={msg.id} className={`flex ${isDoctorMessage ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-xl max-w-[80%] shadow-sm ${isDoctorMessage ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border'}`}>
                                <p className="text-sm">{msg.text}</p>
                                <p className={`text-xs mt-1 ${isDoctorMessage ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left'}`}>
                                    {msg.senderName} - {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })} {msg.isRead === false && !isDoctorMessage ? '(Unread)' : ''}
                                </p>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                    ) : (
                    <p className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">No messages in this chat yet.</p>
                    )}
                </ScrollArea>
                <SheetFooter className="p-4 border-t bg-card">
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
                </SheetFooter>
            </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

export default function DoctorDashboard(props: DoctorDashboardProps) {
  return (
    <Suspense fallback={<DoctorDashboardPageSkeleton />}>
      <DoctorDashboardContent {...props} />
    </Suspense>
  );
}

function DoctorDashboardPageSkeleton({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
      {message && (
        <div className="flex items-center text-lg text-foreground mb-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {message}
        </div>
      )}
      <div className="w-full max-w-7xl p-6 space-y-6 bg-card rounded-lg shadow-md"> 
        <Skeleton className="h-9 w-1/3 mb-3" /> 

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4"> 
            <div className="lg:col-span-1 space-y-4"> 
                <Skeleton className="h-32 rounded-lg" /> 
                <Skeleton className="h-48 rounded-lg" /> 
            </div>
            <DashboardSkeletonCentralColumns />
        </div>
      </div>
    </div>
  );
}

function DashboardSkeletonCentralColumns() {
  return (
    <>
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start"> 
        <Skeleton className="h-28 rounded-lg" />  
        <Skeleton className="h-32 rounded-lg" />  
        <Skeleton className="h-36 rounded-lg" />  
        <Skeleton className="h-44 rounded-lg" />  
        <Skeleton className="h-36 rounded-lg" />  
        <Skeleton className="h-44 rounded-lg" />  
        <Skeleton className="h-40 rounded-lg md:col-span-2 xl:col-span-3" /> 
      </div>
    </>
  );
}
