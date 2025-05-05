'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

interface PatientDashboardProps {
  user: User;
}

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

export default function PatientDashboard({ user }: PatientDashboardProps) {
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
  const { toast } = useToast();

  const form = useForm<SymptomFormValues>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      severity: undefined, // Ensure it starts undefined or with a default if appropriate
      description: "",
    },
  });

 useEffect(() => {
    if (!user) return;

    setLoadingHealth(true);
    setError(null);

    // --- Health Data Listener ---
    const healthQuery = query(
        collection(db, `patients/${user.uid}/healthData`),
        orderBy('timestamp', 'desc'),
        limit(30) // Limit to last 30 entries for chart
    );
    const unsubscribeHealth = onSnapshot(healthQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthData));
        setHealthData(data.reverse()); // Reverse for chronological chart order
        setLoadingHealth(false);
    }, (err) => {
        console.error("Error fetching health data:", err);
        setError("Could not load health data.");
        setLoadingHealth(false);
    });

    // --- Medication Listener ---
     setLoadingMeds(true);
    // TODO: Replace 'medications' with your actual collection name for patient-specific meds
    // This might involve querying a general 'medications' collection filtered by patient assignment
    // or a subcollection like `patients/${user.uid}/assignedMedications`.
    // The current example assumes a subcollection `patients/${user.uid}/medications`. Adapt as needed.
    const medsQuery = query(collection(db, `patients/${user.uid}/medications`));
    const unsubscribeMeds = onSnapshot(medsQuery, (snapshot) => {
        const meds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medication));
        // Simulate adherence for demo purposes
        const medsWithAdherence = meds.map(med => ({
            ...med,
            adherence: med.adherence ?? Math.floor(Math.random() * 41) + 60 // Simulate 60-100% adherence if not present
        }));
        setMedications(medsWithAdherence);
        setLoadingMeds(false);
    }, (err) => {
        console.error("Error fetching medications:", err);
        setError("Could not load medication data.");
        setLoadingMeds(false);
    });


    // --- Symptom Reports Listener ---
    setLoadingSymptoms(true);
    const symptomsQuery = query(
        collection(db, `patients/${user.uid}/symptomReports`),
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


    // --- Fetch Suggested Interventions ---
    const fetchInterventions = async () => {
      setLoadingInterventions(true);
      try {
        // Prepare input for the GenAI flow
        // This requires combining health data, medication adherence, etc. into strings.
        // You might need more sophisticated data preparation based on the AI model's needs.
        const latestHealth = healthData.length > 0 ? healthData[healthData.length - 1] : {};
        const healthSummary = `Latest Health: Steps: ${latestHealth.steps ?? 'N/A'}, HR: ${latestHealth.heartRate ?? 'N/A'}, Glucose: ${latestHealth.bloodGlucose ?? 'N/A'}. `;
        const adherenceSummary = medications.map(m => `${m.name}: ${m.adherence ?? 'N/A'}%`).join(', ');
        const symptomsSummary = symptomReports.map(s => `${s.severity}: ${s.description}`).join(' | ');

        const input = {
          patientHealthData: `${healthSummary} Medication Adherence: ${adherenceSummary}. Recent Symptoms: ${symptomsSummary}`,
          // Simulate risk predictions for now
          riskPredictions: `Readmission Risk: ${Math.random() > 0.7 ? 'High' : 'Low'}. Potential Complications: Dehydration, Medication side-effects.`,
        };

        const result = await generateSuggestedInterventions(input);
        setSuggestedInterventions(result.suggestedInterventions);
      } catch (err) {
        console.error('Error generating suggested interventions:', err);
        // Don't show this error prominently unless needed, it's a background process
        // setError("Could not fetch AI suggestions.");
      } finally {
        setLoadingInterventions(false);
      }
    };

    // Fetch interventions initially and maybe periodically or based on data changes
    // For simplicity, fetch when health data is loaded
     if (!loadingHealth && healthData.length > 0) {
       fetchInterventions();
     }


    // Cleanup listeners on unmount
    return () => {
        unsubscribeHealth();
        unsubscribeMeds();
        unsubscribeSymptoms();
    };
  }, [user, loadingHealth]); // Rerun effect if user changes or health data loads


  const onSubmitSymptom = async (values: SymptomFormValues) => {
      setReportingSymptom(true);
      try {
          await addDoc(collection(db, `patients/${user.uid}/symptomReports`), {
              ...values,
              timestamp: Timestamp.now(),
              userId: user.uid,
          });
          toast({
              title: "Symptom Reported",
              description: "Your healthcare provider has been notified.",
              variant: "default", // Use 'default' or remove for standard styling
               className: "bg-green-100 border-green-300 text-green-800", // Example custom styling
               duration: 5000,
               action: <CheckCircle className="text-green-600" />,
          });
          form.reset(); // Reset form after successful submission
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
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

   const formatDate = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString();
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

      {/* Suggested Interventions Card */}
      {(loadingInterventions || suggestedInterventions) && (
         <Card className="bg-blue-50 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Info className="h-5 w-5" />
                AI Suggestions & Insights
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
                 <p className="text-sm text-blue-600">No specific suggestions at this time.</p>
              )}
            </CardContent>
          </Card>
       )}


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Health Data Summary Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Steps Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingHealth ? <Skeleton className="h-8 w-20" /> :
              <div className="text-2xl font-bold">{healthData[healthData.length - 1]?.steps ?? 'N/A'}</div>
            }
             <p className="text-xs text-muted-foreground">Goal: 8,000 steps</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heart Rate (avg)</CardTitle>
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loadingHealth ? <Skeleton className="h-8 w-16" /> :
               <div className="text-2xl font-bold">{healthData[healthData.length - 1]?.heartRate ?? 'N/A'} bpm</div>
             }
            <p className="text-xs text-muted-foreground">Resting average</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blood Glucose</CardTitle>
             <Droplet className="h-4 w-4 text-muted-foreground" /> {/* Example icon */}
          </CardHeader>
          <CardContent>
             {loadingHealth ? <Skeleton className="h-8 w-16" /> :
                <div className="text-2xl font-bold">{healthData[healthData.length - 1]?.bloodGlucose ?? 'N/A'} mg/dL</div>
             }
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
             {loadingHealth ? <Skeleton className="h-full w-full" /> : healthData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={healthData}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                   <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'Steps', angle: -90, position: 'insideLeft', fill: '#8884d8' }} />
                   <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Heart Rate (bpm)', angle: 90, position: 'insideRight', fill: '#82ca9d' }} />
                   <Tooltip labelFormatter={formatDate} />
                   <Legend />
                   <Bar yAxisId="left" dataKey="steps" fill="hsl(var(--primary))" name="Steps" />
                   <Bar yAxisId="right" dataKey="heartRate" fill="hsl(var(--accent))" name="Heart Rate" />
                 </BarChart>
               </ResponsiveContainer>
             ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No health data available yet.</div>
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
             {loadingMeds ? (
                <>
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                </>
             ) : medications.length > 0 ? (
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
                    {med.lastTaken && <p className="text-xs text-muted-foreground">Last taken: {formatDate(med.lastTaken)} {formatTimestamp(med.lastTaken)}</p>}
                    {/* TODO: Add button to mark as taken */}
                  </div>
                ))
             ) : (
                <p className="text-sm text-muted-foreground">No medications assigned yet.</p>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitSymptom)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>How severe are your symptoms?</FormLabel>
                        <FormControl>
                           {/* Using Buttons as Radio Group for better styling */}
                           <div className="flex gap-2">
                               {(['mild', 'moderate', 'severe'] as const).map((severity) => (
                                   <Button
                                      key={severity}
                                      type="button"
                                      variant={field.value === severity ? 'default' : 'outline'}
                                      onClick={() => field.onChange(severity)}
                                      className={`flex-1 capitalize ${field.value === severity ? 'ring-2 ring-primary ring-offset-2' : ''}`}
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={reportingSymptom} className="w-full">
                  {reportingSymptom ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Report Symptom
                </Button>
              </form>
            </Form>
            {/* Display recent reports */}
             <div className="mt-6 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Recent Reports:</h4>
                 {loadingSymptoms ? <Skeleton className="h-16 w-full" /> :
                   symptomReports.length > 0 ? (
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
                     <p className="text-xs text-muted-foreground">No recent reports.</p>
                 )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
