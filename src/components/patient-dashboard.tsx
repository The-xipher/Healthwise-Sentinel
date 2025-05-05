'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
// Removed: import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db, isFirebaseInitialized, getFirebaseConfigError } from '@/lib/firebase'; // Import helpers
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, AlertTriangle, Droplet, HeartPulse, Pill, Smile, Frown, Meh, Loader2, Info, CheckCircle } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { generateSuggestedInterventions } from '@/ai/flows/generate-suggested-interventions'; // Import the GenAI flow
import { Skeleton } from './ui/skeleton';
import { Label } from './ui/label'; // Import Label for disabled form placeholder

// Removed: interface PatientDashboardProps {
//   user: User;
// }

interface HealthData {
  id: string;
  timestamp: Timestamp;
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number; // Example: add other relevant metrics
  // Add other fields as needed
}

interface Medication {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    lastTaken?: Timestamp; // Optional: track last taken time
    adherence?: number; // Optional: adherence percentage (0-100)
}

interface SymptomReport {
  id: string;
  timestamp: Timestamp;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
}

const symptomFormSchema = z.object({
  severity: z.enum(['mild', 'moderate', 'severe'], {
    required_error: "Please select the severity of your symptoms.",
  }),
  description: z.string().min(10, {
    message: "Please provide a description of at least 10 characters.",
  }).max(500, {
    message: "Description cannot exceed 500 characters.",
  }),
});

type SymptomFormValues = z.infer<typeof symptomFormSchema>;

// Using a placeholder ID since authentication is removed
const PLACEHOLDER_PATIENT_ID = 'test-patient-id';

export default function PatientDashboard(/* Removed: { user }: PatientDashboardProps */) {
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [symptomReports, setSymptomReports] = useState<SymptomReport[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [loadingSymptoms, setLoadingSymptoms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportingSymptom, setReportingSymptom] = useState(false);
  const [suggestedInterventions, setSuggestedInterventions] = useState<string | null>(null);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [firebaseActive, setFirebaseActive] = useState(false);
  const { toast } = useToast();

  const form = useForm<SymptomFormValues>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      severity: undefined, // Ensure it starts undefined or with a default if appropriate
      description: "",
    },
  });

  useEffect(() => {
    const firebaseReady = isFirebaseInitialized();
    setFirebaseActive(firebaseReady);
    if (!firebaseReady) {
        setError(getFirebaseConfigError() || "Firebase is not available.");
        setLoadingHealth(false);
        setLoadingMeds(false);
        setLoadingSymptoms(false);
        setLoadingInterventions(false);
        return; // Stop if Firebase isn't working
    }
    // If Firebase is ready, proceed with listeners
    setError(null); // Clear potential config error

    setLoadingHealth(true);
    setLoadingMeds(true);
    setLoadingSymptoms(true);

    // --- Health Data Listener ---
    const healthQuery = query(
        collection(db!, `patients/${PLACEHOLDER_PATIENT_ID}/healthData`), // Use db! (non-null assertion)
        orderBy('timestamp', 'desc'),
        limit(30) // Limit to last 30 entries for chart
    );
    const unsubscribeHealth = onSnapshot(healthQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthData));
        setHealthData(data.reverse()); // Reverse for chronological chart order
        setLoadingHealth(false);
        // Trigger AI suggestions fetch after health data is loaded
        fetchInterventionsIfNeeded(data.reverse());
    }, (err) => {
        console.error("Error fetching health data:", err);
        setError("Could not load health data.");
        setLoadingHealth(false);
    });

    // --- Medication Listener ---
    const medsQuery = query(collection(db!, `patients/${PLACEHOLDER_PATIENT_ID}/medications`));
    const unsubscribeMeds = onSnapshot(medsQuery, (snapshot) => {
        const meds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medication));
        const medsWithAdherence = meds.map(med => ({
            ...med,
            adherence: med.adherence ?? Math.floor(Math.random() * 41) + 60
        }));
        setMedications(medsWithAdherence);
        setLoadingMeds(false);
    }, (err) => {
        console.error("Error fetching medications:", err);
        setError("Could not load medication data.");
        setLoadingMeds(false);
    });


    // --- Symptom Reports Listener ---
    const symptomsQuery = query(
        collection(db!, `patients/${PLACEHOLDER_PATIENT_ID}/symptomReports`),
        orderBy('timestamp', 'desc'),
        limit(5) // Limit to last 5 reports
    );
    const unsubscribeSymptoms = onSnapshot(symptomsQuery, (snapshot) => {
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SymptomReport));
        setSymptomReports(reports);
        setLoadingSymptoms(false);
    }, (err) => {
        console.error("Error fetching symptom reports:", err);
        setError("Could not load symptom reports.");
        setLoadingSymptoms(false);
    });


    // --- Function to fetch suggested interventions ---
    const fetchInterventionsIfNeeded = async (currentHealthData: HealthData[]) => {
      if (!firebaseReady || loadingInterventions || suggestedInterventions !== null) return; // Don't run if Firebase inactive, already loading, or already fetched

      setLoadingInterventions(true);
      try {
        const latestHealth = currentHealthData.length > 0 ? currentHealthData[currentHealthData.length - 1] : {};
        // Get summaries even if some data is loading/empty
        const healthSummary = `Latest Health: Steps: ${latestHealth.steps ?? 'N/A'}, HR: ${latestHealth.heartRate ?? 'N/A'}, Glucose: ${latestHealth.bloodGlucose ?? 'N/A'}. `;
        const adherenceSummary = medications.map(m => `${m.name}: ${m.adherence ?? 'N/A'}%`).join(', ') || "No medication data yet.";
        const symptomsSummary = symptomReports.map(s => `${s.severity}: ${s.description}`).join(' | ') || "No recent symptoms reported.";

        const input = {
          patientHealthData: `${healthSummary} Medication Adherence: ${adherenceSummary}. Recent Symptoms: ${symptomsSummary}`,
          // Simplified risk prediction for example
          riskPredictions: `Readmission Risk: ${Math.random() > 0.7 ? 'High' : 'Low'}. Potential Complications: Dehydration, Medication side-effects.`,
        };

        const result = await generateSuggestedInterventions(input);
        setSuggestedInterventions(result.suggestedInterventions);
      } catch (err) {
        console.error('Error generating suggested interventions:', err);
        // Avoid setting error state here to not overwrite primary Firebase errors
        toast({ title: "AI Suggestion Error", description: "Could not generate AI suggestions.", variant: "destructive"});
      } finally {
        setLoadingInterventions(false);
      }
    };


    // Cleanup listeners on unmount
    return () => {
        unsubscribeHealth();
        unsubscribeMeds();
        unsubscribeSymptoms();
    };
  }, [firebaseActive]); // Re-run effect only when firebaseActive changes


  const onSubmitSymptom = async (values: SymptomFormValues) => {
      if (!firebaseActive || !db) {
        toast({ title: "Error", description: "Cannot submit report. Database connection inactive.", variant: "destructive" });
        return;
      }
      setReportingSymptom(true);
      try {
          await addDoc(collection(db, `patients/${PLACEHOLDER_PATIENT_ID}/symptomReports`), {
              ...values,
              timestamp: Timestamp.now(),
              userId: PLACEHOLDER_PATIENT_ID, // Use placeholder ID
          });
          toast({
              title: "Symptom Reported",
              description: "Your healthcare provider has been notified.",
              variant: "default",
               className: "bg-green-100 border-green-300 text-green-800",
               duration: 5000
              //  action: <CheckCircle className="text-green-600" /> // Removed due to syntax error and potential incorrect usage
          });
          form.reset();
      } catch (err) {
          console.error("Error reporting symptom:", err);
          toast({
              title: "Error Reporting Symptom",
              description: "Could not save your report. Please try again.",
              variant: "destructive",
              duration: 5000,
          });
      } finally {
          setReportingSymptom(false);
      }
  };


  const formatTimestamp = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    // Format for chart axis (short time)
    return timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' });
  };

   const formatDate = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    // Format for tooltips/display (date + time)
    return timestamp.toDate().toLocaleString();
   };

   const getSeverityIcon = (severity: 'mild' | 'moderate' | 'severe') => {
    switch(severity) {
        case 'mild': return <Smile className="text-green-500 h-5 w-5" />;
        case 'moderate': return <Meh className="text-yellow-500 h-5 w-5" />;
        case 'severe': return <Frown className="text-red-500 h-5 w-5" />;
        default: return null;
    }
   };

   const getAdherenceColor = (adherence: number | undefined): string => {
     if (adherence === undefined) return 'bg-gray-300'; // Unknown
     if (adherence >= 90) return 'bg-green-500'; // Good
     if (adherence >= 70) return 'bg-yellow-500'; // Moderate
     return 'bg-red-500'; // Poor
   }

  // Display skeleton if any core data is still loading (and Firebase is supposed to be active)
  const showSkeleton = firebaseActive && (loadingHealth || loadingMeds || loadingSymptoms);

  return (
    <div className="space-y-6">
       <h1 className="text-3xl font-bold text-foreground">Patient Dashboard</h1>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Suggested Interventions Card - Only show if Firebase is active */}
      {firebaseActive && (loadingInterventions || suggestedInterventions !== null) && (
         <Card className="bg-blue-50 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Info className="h-5 w-5" />
                AI Suggestions &amp; Insights
              </CardTitle>
               <CardDescription className="text-blue-600">
                Based on your recent data, here are some suggestions. Always consult your doctor before making changes.
               </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingInterventions ? (
                 <div className="flex items-center space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-blue-600">Generating recommendations...</span>
                </div>
              ) : suggestedInterventions ? (
                 <p className="text-sm text-blue-700 whitespace-pre-line">{suggestedInterventions}</p>
              ) : (
                 <p className="text-sm text-blue-600">No specific suggestions available at this time.</p>
              )}
            </CardContent>
          </Card>
       )}

      { showSkeleton ? (
        // Show Skeleton layout if loading
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-[350px] rounded-lg md:col-span-2 lg:col-span-3" />
            <Skeleton className="h-48 rounded-lg lg:col-span-2" />
            <Skeleton className="h-72 rounded-lg lg:col-span-1" />
        </div>
      ) : (
        // Show actual dashboard content when loaded
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Health Data Summary Cards */}
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Steps Today</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{healthData[healthData.length - 1]?.steps ?? 'N/A'}</div>
                <p className="text-xs text-muted-foreground">Goal: 8,000 steps</p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Heart Rate (avg)</CardTitle>
                <HeartPulse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{healthData[healthData.length - 1]?.heartRate ?? 'N/A'} bpm</div>
                <p className="text-xs text-muted-foreground">Latest reading</p> {/* Updated description */}
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blood Glucose</CardTitle>
                <Droplet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{healthData[healthData.length - 1]?.bloodGlucose ?? 'N/A'} mg/dL</div>
                <p className="text-xs text-muted-foreground">Latest reading</p>
            </CardContent>
            </Card>


            {/* Health Data Chart */}
            <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
                <CardTitle>Recent Health Trends</CardTitle>
                <CardDescription>Steps and Heart Rate over the last recorded entries.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[350px]">
                {firebaseActive && healthData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={healthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => formatTimestamp(ts)} /> {/* Use specific formatter */}
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" label={{ value: 'Steps', angle: -90, position: 'insideLeft', fill: 'hsl(var(--primary))' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" label={{ value: 'Heart Rate (bpm)', angle: 90, position: 'insideRight', fill: 'hsl(var(--accent))' }} />
                    <Tooltip labelFormatter={(label, payload) => formatDate(payload?.[0]?.payload?.timestamp)} /> {/* Format tooltip label */}
                    <Legend />
                    <Bar yAxisId="left" dataKey="steps" fill="hsl(var(--primary))" name="Steps" />
                    <Bar yAxisId="right" dataKey="heartRate" fill="hsl(var(--accent))" name="Heart Rate" />
                    </BarChart>
                </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        {firebaseActive ? "No health data available yet." : "Health data unavailable (Firebase inactive)."}</div>
                )}
            </CardContent>
            </Card>

            {/* Medication Adherence */}
            <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Medication Adherence
                </CardTitle>
                <CardDescription>Tracking your medication schedule.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {firebaseActive && medications.length > 0 ? (
                    medications.map((med) => (
                    <div key={med.id} className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">{med.name} ({med.dosage}, {med.frequency})</span>
                            <Badge variant={med.adherence && med.adherence >= 90 ? 'default' : med.adherence && med.adherence >= 70 ? 'secondary' : 'destructive'}
                                className={getAdherenceColor(med.adherence)}>
                                {med.adherence !== undefined ? `${med.adherence}%` : 'N/A'}
                            </Badge>
                        </div>
                        <Progress value={med.adherence} className={`h-2 ${getAdherenceColor(med.adherence)}`} aria-label={`${med.name} adherence ${med.adherence}%`} />
                        {med.lastTaken && <p className="text-xs text-muted-foreground">Last taken: {formatDate(med.lastTaken)}</p>} {/* Simplified date format */}
                    </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {firebaseActive ? "No medications assigned yet." : "Medication data unavailable (Firebase inactive)."}</p>
                )}
            </CardContent>
            </Card>

            {/* Symptom Reporting */}
            <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>Report Symptoms</CardTitle>
                <CardDescription>Let your doctor know how you're feeling.</CardDescription>
            </CardHeader>
            <CardContent>
                {!firebaseActive && (
                     <Alert variant="default" className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-800">
                       <AlertTriangle className="h-4 w-4 text-yellow-600" />
                       <AlertTitle>Database Connection Required</AlertTitle>
                       <AlertDescription>
                         Symptom reporting requires an active database connection. Please ensure Firebase is configured correctly.
                       </AlertDescription>
                     </Alert>
                 )}
                 {firebaseActive ? (
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitSymptom)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="severity"
                            render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>How severe are your symptoms?</FormLabel>
                                <FormControl>
                                <div className="flex gap-2">
                                    {(['mild', 'moderate', 'severe'] as const).map((severity) => (
                                        <Button
                                            key={severity}
                                            type="button"
                                            variant={field.value === severity ? 'default' : 'outline'}
                                            onClick={() => field.onChange(severity)}
                                            className={`flex-1 capitalize ${field.value === severity ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                            disabled={!firebaseActive || reportingSymptom} // Disable if Firebase inactive or submitting
                                        >
                                            {getSeverityIcon(severity)}
                                            <span className="ml-2">{severity}</span>
                                        </Button>
                                    ))}
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Describe your symptoms</FormLabel>
                            <FormControl>
                                <Textarea
                                placeholder="e.g., Feeling dizzy, short of breath..."
                                {...field}
                                disabled={!firebaseActive || reportingSymptom} // Disable if Firebase inactive or submitting
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <Button type="submit" disabled={reportingSymptom || !firebaseActive} className="w-full">
                        {reportingSymptom ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Report Symptom
                        </Button>
                    </form>
                    </Form>
                 ) : (
                    // Optional: Show a disabled placeholder form if needed
                    <div className="space-y-4 opacity-50 cursor-not-allowed">
                        {/* Placeholder for disabled form elements */}
                         <div className="space-y-3">
                            <Label>How severe are your symptoms?</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant='outline' className="flex-1 capitalize" disabled><Smile className="h-5 w-5 mr-2" />mild</Button>
                                <Button type="button" variant='outline' className="flex-1 capitalize" disabled><Meh className="h-5 w-5 mr-2" />moderate</Button>
                                <Button type="button" variant='outline' className="flex-1 capitalize" disabled><Frown className="h-5 w-5 mr-2" />severe</Button>
                            </div>
                         </div>
                         <div className="space-y-2">
                             <Label>Describe your symptoms</Label>
                             <Textarea placeholder="e.g., Feeling dizzy, short of breath..." disabled />
                         </div>
                         <Button type="submit" disabled className="w-full">Report Symptom</Button>
                    </div>
                 )}
                {/* Display recent reports */}
                <div className="mt-6 space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Recent Reports:</h4>
                    {firebaseActive && symptomReports.length > 0 ? (
                        symptomReports.map(report => (
                            <div key={report.id} className="text-xs p-2 border rounded-md bg-muted/50 flex items-start gap-2">
                                {getSeverityIcon(report.severity)}
                                <div>
                                    <span className="font-semibold capitalize">{report.severity}</span> on {formatDate(report.timestamp)}:
                                    <p className="text-muted-foreground">{report.description}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-muted-foreground">
                           {firebaseActive ? "No recent reports." : "Symptom reports unavailable (Firebase inactive)."}</p>
                    )}
                </div>
            </CardContent>
            </Card>
        </div>
        )}
    </div>
  );
}
