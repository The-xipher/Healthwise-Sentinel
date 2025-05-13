
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
// Removed direct mongodb imports: connectToDatabase, toObjectId
import type { ObjectId } from 'mongodb'; // Keep for type definitions if necessary
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
import { generateSuggestedInterventions } from '@/ai/flows/generate-suggested-interventions';
import { Skeleton } from './ui/skeleton';
import { Label } from './ui/label';
import {
  fetchPatientDashboardDataAction,
  submitSymptomReportAction,
  PatientHealthData,
  PatientMedication,
  PatientSymptomReport
} from '@/app/actions/patientActions'; // Import server actions

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

// Updated to a valid 24-character hex string for MongoDB ObjectId compatibility
const PLACEHOLDER_PATIENT_ID = '507f1f77bcf86cd799439011'; 

export default function PatientDashboard() {
  const [healthData, setHealthData] = useState<PatientHealthData[]>([]);
  const [medications, setMedications] = useState<PatientMedication[]>([]);
  const [symptomReports, setSymptomReports] = useState<PatientSymptomReport[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportingSymptom, setReportingSymptom] = useState(false);
  const [suggestedInterventions, setSuggestedInterventions] = useState<string | null>(null);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const { toast } = useToast();
  const [dbAvailable, setDbAvailable] = useState(true);

  const form = useForm<SymptomFormValues>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      severity: undefined,
      description: "",
    },
  });
  
  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      setError(null);
      try {
        const result = await fetchPatientDashboardDataAction(PLACEHOLDER_PATIENT_ID);
        if (result.error) {
          setError(result.error);
          if (result.error.startsWith("Invalid patient ID format") || result.error.includes("Database connection")) {
            setDbAvailable(false); 
          }
          setHealthData([]);
          setMedications([]);
          setSymptomReports([]);
        } else {
          setHealthData(result.healthData || []);
          setMedications(result.medications || []);
          setSymptomReports(result.symptomReports || []);
          setDbAvailable(true);
          // Trigger AI suggestions fetch after all data is loaded
          fetchInterventionsIfNeeded(result.healthData || [], result.medications || [], result.symptomReports || []);
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred fetching patient data.');
        setDbAvailable(false);
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  const fetchInterventionsIfNeeded = async (
    currentHealthData: PatientHealthData[],
    currentMedications: PatientMedication[],
    currentSymptomReports: PatientSymptomReport[]
  ) => {
    if (loadingInterventions || suggestedInterventions !== null || !dbAvailable) return;

    setLoadingInterventions(true);
    try {
      const latestHealth = currentHealthData.length > 0 ? currentHealthData[currentHealthData.length - 1] : {} as PatientHealthData;
      const healthSummary = `Latest Health: Steps: ${latestHealth.steps ?? 'N/A'}, HR: ${latestHealth.heartRate ?? 'N/A'}, Glucose: ${latestHealth.bloodGlucose ?? 'N/A'}. `;
      const adherenceSummary = currentMedications.map(m => `${m.name}: ${m.adherence ?? 'N/A'}%`).join(', ') || "No medication data yet.";
      const symptomsSummaryText = currentSymptomReports.map(s => `${s.severity}: ${s.description}`).join(' | ') || "No recent symptoms reported.";

      const input = {
        patientHealthData: `${healthSummary} Medication Adherence: ${adherenceSummary}. Recent Symptoms: ${symptomsSummaryText}`,
        // Example risk, can be enhanced with actual data if available from patient profile
        riskPredictions: `Readmission Risk: ${Math.random() > 0.7 ? 'High' : 'Low'}. Potential Complications: Dehydration, Medication side-effects.`, 
      };

      const result = await generateSuggestedInterventions(input);
      setSuggestedInterventions(result.suggestedInterventions);
    } catch (err) {
      console.error('Error generating suggested interventions:', err);
      toast({ title: "AI Suggestion Error", description: "Could not generate AI suggestions.", variant: "destructive" });
      // Do not set dbAvailable to false here as AI failure is different from DB failure
    } finally {
      setLoadingInterventions(false);
    }
  };
  
  const onSubmitSymptom = async (values: SymptomFormValues) => {
    if (!dbAvailable) {
       toast({ title: "Error", description: "Cannot submit report. Database connection inactive.", variant: "destructive" });
       return;
    }
    setReportingSymptom(true);
    try {
      const result = await submitSymptomReportAction(PLACEHOLDER_PATIENT_ID, values.severity, values.description);
      if (result.error) {
        toast({
          title: "Error Reporting Symptom",
          description: result.error,
          variant: "destructive",
        });
      } else if (result.report) {
        setSymptomReports(prev => [result.report!, ...prev].slice(0,5));
        toast({
          title: "Symptom Reported",
          description: "Your healthcare provider has been notified.",
          variant: "default", // "default" is usually white/gray, make it visually distinct as success
          className: "bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200",
          duration: 5000,
          action: <CheckCircle className="text-green-600 dark:text-green-400" />,
        });
        form.reset();
      }
    } catch (err) {
      console.error("Error reporting symptom:", err);
      toast({
        title: "Error Reporting Symptom",
        description: "Could not save your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setReportingSymptom(false);
    }
  };

  const formatTimestampForChart = (timestamp: Date | string | undefined): string => {
    if (!timestamp) return 'N/A';
    // More concise time format for charts
    return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateForDisplay = (timestamp: Date | string | undefined): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityIcon = (severity: 'mild' | 'moderate' | 'severe') => {
    switch (severity) {
      case 'mild': return <Smile className="text-green-500 h-5 w-5" />;
      case 'moderate': return <Meh className="text-yellow-500 h-5 w-5" />;
      case 'severe': return <Frown className="text-red-500 h-5 w-5" />;
      default: return null;
    }
  };

  const getAdherenceColor = (adherence: number | undefined): string => {
    // These will use Tailwind's theme colors for primary/secondary/destructive via Progress component variants logic if available
    // Or direct bg classes if Progress doesn't support variant colors well.
    // For Progress, usually the fill color itself is changed, not the component class.
    if (adherence === undefined) return 'bg-muted'; // gray-300 equivalent
    if (adherence >= 90) return 'bg-primary'; // green-500 equivalent (or primary theme color)
    if (adherence >= 70) return 'bg-yellow-500'; // yellow-500 equivalent
    return 'bg-destructive'; // red-500 equivalent (or destructive theme color)
  };

  const showSkeleton = loadingData && !error; // Show skeleton only during initial load without error

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
      
      {!dbAvailable && !loadingData && !error && ( // Shown if DB is determined unavailable after load attempt & no other error
         <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle>Database Disconnected</AlertTitle>
            <AlertDescription>
                Database features are currently offline. Data cannot be loaded or saved. Check .env and MongoDB connection.
            </AlertDescription>
         </Alert>
       )}

      {(loadingInterventions || suggestedInterventions !== null) && ( // Show AI card if loading or has suggestions
        <Card className="bg-blue-50 border-blue-200 shadow-md hover:shadow-lg transition-shadow dark:bg-blue-900 dark:border-blue-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
              <Info className="h-5 w-5" />
              AI Suggestions &amp; Insights
            </CardTitle>
            <CardDescription className="text-blue-600 dark:text-blue-300">
              Based on your recent data, here are some suggestions. Always consult your doctor before making changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInterventions ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-blue-600 dark:text-blue-300">Generating recommendations...</span>
              </div>
            ) : suggestedInterventions ? (
              <p className="text-sm text-blue-700 dark:text-blue-200 whitespace-pre-line">{suggestedInterventions}</p>
            ) : (
              // Only show "no suggestions" if not loading and db was available for attempt
              dbAvailable && <p className="text-sm text-blue-600 dark:text-blue-300">No specific suggestions available at this time.</p>
            )}
          </CardContent>
        </Card>
      )}

      {showSkeleton ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-[350px] rounded-lg md:col-span-2 lg:col-span-3" />
          <Skeleton className="h-48 rounded-lg lg:col-span-2" />
          <Skeleton className="h-72 rounded-lg lg:col-span-1" />
        </div>
      ) : (
        !error && dbAvailable && // Only render data cards if no error and db is available
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <p className="text-xs text-muted-foreground">Latest reading</p>
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

          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Recent Health Trends</CardTitle>
              <CardDescription>Steps and Heart Rate over the last recorded entries.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[350px]">
              {healthData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={healthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => formatTimestampForChart(ts as string)} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-1))" label={{ value: 'Steps', angle: -90, position: 'insideLeft', fill: 'hsl(var(--chart-1))' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" label={{ value: 'Heart Rate (bpm)', angle: 90, position: 'insideRight', fill: 'hsl(var(--chart-2))' }} />
                    <Tooltip 
                        labelFormatter={(label, payload) => formatDateForDisplay(payload?.[0]?.payload?.timestamp as string)}
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                     />
                    <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }}/>
                    <Bar yAxisId="left" dataKey="steps" fill="hsl(var(--chart-1))" name="Steps" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="heartRate" fill="hsl(var(--chart-2))" name="Heart Rate" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No health data available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" /> Medication Adherence
              </CardTitle>
              <CardDescription>Tracking your medication schedule.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {medications.length > 0 ? (
                medications.map((med) => (
                  <div key={med.id!} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{med.name} ({med.dosage}, {med.frequency})</span>
                       <Badge variant={med.adherence && med.adherence >= 90 ? 'default' : med.adherence && med.adherence >= 70 ? 'secondary' : 'destructive'}>
                        {med.adherence !== undefined ? `${med.adherence}%` : 'N/A'}
                      </Badge>
                    </div>
                    <Progress value={med.adherence} className="h-2" aria-label={`${med.name} adherence ${med.adherence}%`} />
                    {med.lastTaken && <p className="text-xs text-muted-foreground">Last taken: {formatDateForDisplay(med.lastTaken)}</p>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No medications assigned yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Report Symptoms</CardTitle>
              <CardDescription>Let your doctor know how you're feeling.</CardDescription>
            </CardHeader>
            <CardContent>
              {!dbAvailable && !loadingData && ( 
                <Alert variant="default" className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <AlertTitle>Symptom Reporting Unavailable</AlertTitle>
                  <AlertDescription>
                    Database connection is required to report symptoms.
                  </AlertDescription>
                </Alert>
              )}
              {dbAvailable || loadingData ? ( 
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
                                  className={`flex-1 capitalize ${field.value === severity ? 'ring-2 ring-primary ring-offset-background dark:ring-offset-card' : ''}`}
                                  disabled={!dbAvailable || reportingSymptom} 
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
                              disabled={!dbAvailable || reportingSymptom}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={reportingSymptom || !dbAvailable} className="w-full">
                      {reportingSymptom ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Report Symptom
                    </Button>
                  </form>
                </Form>
              ) : ( 
                 <div className="space-y-4 opacity-50 cursor-not-allowed">
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
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Recent Reports:</h4>
                {symptomReports.length > 0 ? (
                  symptomReports.map(report => (
                    <div key={report.id!} className="text-xs p-2 border rounded-md bg-muted/50 dark:bg-muted/20 flex items-start gap-2">
                      {getSeverityIcon(report.severity)}
                      <div>
                        <span className="font-semibold capitalize">{report.severity}</span> on {formatDateForDisplay(report.timestamp)}:
                        <p className="text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {dbAvailable ? "No recent reports." : "Symptom reports unavailable."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

    