'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { connectToDatabase, toObjectId, ObjectId } from '@/lib/mongodb';
import type { Db } from 'mongodb';
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

interface HealthData {
  _id?: ObjectId | string;
  id?: string; // Mapped from _id
  patientId: string | ObjectId;
  timestamp: Date;
  steps?: number;
  heartRate?: number;
  bloodGlucose?: number;
}

interface Medication {
  _id?: ObjectId | string;
  id?: string; // Mapped from _id
  patientId: string | ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  lastTaken?: Date;
  adherence?: number;
}

interface SymptomReport {
  _id?: ObjectId | string;
  id?: string; // Mapped from _id
  patientId: string | ObjectId;
  timestamp: Date;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  userId: string; // Keep if it was part of the original schema
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

const PLACEHOLDER_PATIENT_ID = 'test-patient-id'; // This will be string, convert to ObjectId for DB ops

export default function PatientDashboard() {
  const [dbInstance, setDbInstance] = useState<Db | null>(null);
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [symptomReports, setSymptomReports] = useState<SymptomReport[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const [reportingSymptom, setReportingSymptom] = useState(false);
  const [suggestedInterventions, setSuggestedInterventions] = useState<string | null>(null);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const { toast } = useToast();

  const form = useForm<SymptomFormValues>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      severity: undefined,
      description: "",
    },
  });
  
  const patientObjectId = useMemo(() => toObjectId(PLACEHOLDER_PATIENT_ID), []);


  useEffect(() => {
    async function initializeDb() {
      try {
        const { db } = await connectToDatabase();
        setDbInstance(db);
      } catch (e) {
        setError('Failed to connect to the database.');
        console.error(e);
        setLoadingData(false);
        setLoadingInterventions(false);
      }
    }
    initializeDb();
  }, []);

  useEffect(() => {
    if (!dbInstance || !patientObjectId) {
      if (!error) setLoadingData(true); // Only set loading if no db connection error yet
      return;
    }
    
    async function fetchData() {
      setLoadingData(true);
      try {
        // Fetch Health Data
        const healthCollection = dbInstance!.collection<HealthData>('healthData');
        const fetchedHealthData = await healthCollection.find({ patientId: patientObjectId })
          .sort({ timestamp: -1 }).limit(30).toArray();
        setHealthData(fetchedHealthData.reverse().map(d => ({...d, id: d._id?.toString()}))); // Reverse for chronological chart

        // Fetch Medications
        const medsCollection = dbInstance!.collection<Medication>('medications');
        const fetchedMeds = await medsCollection.find({ patientId: patientObjectId }).toArray();
        setMedications(fetchedMeds.map(med => ({
          ...med,
          id: med._id?.toString(),
          adherence: med.adherence ?? Math.floor(Math.random() * 41) + 60
        })));

        // Fetch Symptom Reports
        const symptomsCollection = dbInstance!.collection<SymptomReport>('symptomReports');
        const fetchedSymptoms = await symptomsCollection.find({ patientId: patientObjectId })
          .sort({ timestamp: -1 }).limit(5).toArray();
        setSymptomReports(fetchedSymptoms.map(s => ({...s, id: s._id?.toString()})));

        // Trigger AI suggestions fetch after all data is loaded
        fetchInterventionsIfNeeded(fetchedHealthData.reverse(), fetchedMeds, fetchedSymptoms);

      } catch (err) {
        console.error("Error fetching patient data:", err);
        setError("Could not load patient data.");
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [dbInstance, patientObjectId, error]); // Added error to dependency array

  const fetchInterventionsIfNeeded = async (
    currentHealthData: HealthData[],
    currentMedications: Medication[],
    currentSymptomReports: SymptomReport[]
  ) => {
    if (!dbInstance || loadingInterventions || suggestedInterventions !== null || !patientObjectId) return;

    setLoadingInterventions(true);
    try {
      const latestHealth = currentHealthData.length > 0 ? currentHealthData[currentHealthData.length - 1] : {} as HealthData;
      const healthSummary = `Latest Health: Steps: ${latestHealth.steps ?? 'N/A'}, HR: ${latestHealth.heartRate ?? 'N/A'}, Glucose: ${latestHealth.bloodGlucose ?? 'N/A'}. `;
      const adherenceSummary = currentMedications.map(m => `${m.name}: ${m.adherence ?? 'N/A'}%`).join(', ') || "No medication data yet.";
      const symptomsSummaryText = currentSymptomReports.map(s => `${s.severity}: ${s.description}`).join(' | ') || "No recent symptoms reported.";

      const input = {
        patientHealthData: `${healthSummary} Medication Adherence: ${adherenceSummary}. Recent Symptoms: ${symptomsSummaryText}`,
        riskPredictions: `Readmission Risk: ${Math.random() > 0.7 ? 'High' : 'Low'}. Potential Complications: Dehydration, Medication side-effects.`,
      };

      const result = await generateSuggestedInterventions(input);
      setSuggestedInterventions(result.suggestedInterventions);
    } catch (err) {
      console.error('Error generating suggested interventions:', err);
      toast({ title: "AI Suggestion Error", description: "Could not generate AI suggestions.", variant: "destructive" });
    } finally {
      setLoadingInterventions(false);
    }
  };
  
  const onSubmitSymptom = async (values: SymptomFormValues) => {
    if (!dbInstance || !patientObjectId) {
      toast({ title: "Error", description: "Cannot submit report. Database connection inactive.", variant: "destructive" });
      return;
    }
    setReportingSymptom(true);
    const report: Omit<SymptomReport, '_id' | 'id'> = {
      ...values,
      patientId: patientObjectId,
      timestamp: new Date(),
      userId: PLACEHOLDER_PATIENT_ID, // Using placeholder string ID for userId field
    };

    try {
      const symptomsCollection = dbInstance.collection<SymptomReport>('symptomReports');
      const result = await symptomsCollection.insertOne(report as SymptomReport); // Cast to include _id
      
      // Optimistically update UI
      setSymptomReports(prev => [{...report, _id:result.insertedId, id: result.insertedId.toString()}, ...prev].slice(0,5));

      toast({
        title: "Symptom Reported",
        description: "Your healthcare provider has been notified.",
        variant: "default",
        className: "bg-green-100 border-green-300 text-green-800",
        duration: 5000,
        // action: <CheckCircle className="text-green-600 h-5 w-5" /> // Keep if needed, ensure CheckCircle is imported
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

  const formatTimestampForChart = (timestamp: Date | undefined): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateForDisplay = (timestamp: Date | undefined): string => {
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
    if (adherence === undefined) return 'bg-gray-300';
    if (adherence >= 90) return 'bg-green-500';
    if (adherence >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const dbAvailable = !!dbInstance;
  const showSkeleton = (!dbAvailable && loadingData && !error) || (dbAvailable && loadingData);

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
      
      {!dbAvailable && !error && (
         <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Database Disconnected</AlertTitle>
            <AlertDescription>
                Database features are currently offline. Data cannot be loaded or saved.
            </AlertDescription>
         </Alert>
       )}

      {dbAvailable && (loadingInterventions || suggestedInterventions !== null) && (
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
              {dbAvailable && healthData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={healthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => formatTimestampForChart(ts as Date)} />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" label={{ value: 'Steps', angle: -90, position: 'insideLeft', fill: 'hsl(var(--primary))' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" label={{ value: 'Heart Rate (bpm)', angle: 90, position: 'insideRight', fill: 'hsl(var(--accent))' }} />
                    <Tooltip labelFormatter={(label, payload) => formatDateForDisplay(payload?.[0]?.payload?.timestamp as Date)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="steps" fill="hsl(var(--primary))" name="Steps" />
                    <Bar yAxisId="right" dataKey="heartRate" fill="hsl(var(--accent))" name="Heart Rate" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {dbAvailable ? "No health data available yet." : "Health data unavailable."}
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
              {dbAvailable && medications.length > 0 ? (
                medications.map((med) => (
                  <div key={med.id!} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{med.name} ({med.dosage}, {med.frequency})</span>
                      <Badge variant={med.adherence && med.adherence >= 90 ? 'default' : med.adherence && med.adherence >= 70 ? 'secondary' : 'destructive'}
                        className={getAdherenceColor(med.adherence)}>
                        {med.adherence !== undefined ? `${med.adherence}%` : 'N/A'}
                      </Badge>
                    </div>
                    <Progress value={med.adherence} className={`h-2 ${getAdherenceColor(med.adherence)}`} aria-label={`${med.name} adherence ${med.adherence}%`} />
                    {med.lastTaken && <p className="text-xs text-muted-foreground">Last taken: {formatDateForDisplay(med.lastTaken)}</p>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {dbAvailable ? "No medications assigned yet." : "Medication data unavailable."}
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
              {!dbAvailable && (
                <Alert variant="default" className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle>Database Connection Required</AlertTitle>
                  <AlertDescription>
                    Symptom reporting requires an active database connection.
                  </AlertDescription>
                </Alert>
              )}
              {dbAvailable ? (
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
                {dbAvailable && symptomReports.length > 0 ? (
                  symptomReports.map(report => (
                    <div key={report.id!} className="text-xs p-2 border rounded-md bg-muted/50 flex items-start gap-2">
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
