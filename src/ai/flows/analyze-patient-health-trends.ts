
'use server';
/**
 * @fileOverview Analyzes patient health data trends, medication adherence, and risk profile
 * to identify concerning patterns and suggest actions for the doctor.
 *
 * - analyzePatientHealthTrends - Function to call the AI flow.
 * - AnalyzePatientHealthTrendsInput - Input type for the flow.
 * - AnalyzePatientHealthTrendsOutput - Output type from the flow.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzePatientHealthTrendsInputSchema = z.object({
  patientId: z.string().describe('The ID of the patient.'),
  recentHealthDataSummary: z.string().describe("A textual summary of the patient's recent health data entries (e.g., vital signs like blood pressure, heart rate, blood glucose, steps) over the last few days or entries. Example: 'Recent Vitals (last 3 entries, newest first): - Date1: BP 145/95, HR 80, Glucose 130mg/dL - Date2: BP 150/92, HR 82, Glucose 125mg/dL - Date3: BP 148/90, HR 78, Glucose 135mg/dL'"),
  medicationAdherenceSummary: z.string().describe("A textual summary of the patient's adherence to key medications. Example: 'Medication Adherence: - Lisinopril (10mg): 75% over last 7 days - Metformin (500mg): 90% over last 7 days'"),
  patientRiskProfile: z.string().describe("A summary of the patient's known risk factors, e.g., 'High readmission risk. History of hypertension, Diabetes Type 2. Current concern: Recent cough.'"),
});
export type AnalyzePatientHealthTrendsInput = z.infer<typeof AnalyzePatientHealthTrendsInputSchema>;

const AnalyzePatientHealthTrendsOutputSchema = z.object({
  isTrendConcerning: z.boolean().describe('Whether any concerning trends were identified in the patient data.'),
  trendSummary: z.string().nullable().describe('If a concerning trend is identified, this provides a concise summary of what the trend is and why it is concerning. Null if no concerning trends.'),
  suggestedActionForDoctor: z.string().nullable().describe('If a concerning trend is identified, this suggests a concrete, actionable step for the doctor to consider. Null if no concerning trends or no specific action is recommended.'),
});
export type AnalyzePatientHealthTrendsOutput = z.infer<typeof AnalyzePatientHealthTrendsOutputSchema>;

export async function analyzePatientHealthTrends(input: AnalyzePatientHealthTrendsInput): Promise<AnalyzePatientHealthTrendsOutput> {
  return analyzePatientHealthTrendsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzePatientHealthTrendsPrompt',
  input: {schema: AnalyzePatientHealthTrendsInputSchema},
  output: {schema: AnalyzePatientHealthTrendsOutputSchema},
  prompt: `You are an AI clinical data analyst assisting a doctor. Your role is to analyze patient health data trends, medication adherence, and their overall risk profile to identify any concerning patterns that might require medical attention or intervention.

Patient ID: {{{patientId}}}
Patient Risk Profile:
{{{patientRiskProfile}}}

Recent Health Data Summary (e.g., vitals over several days):
{{{recentHealthDataSummary}}}

Medication Adherence Summary:
{{{medicationAdherenceSummary}}}

Analyze all the provided information carefully. Look for:
- Sustained vital signs outside normal ranges (e.g., consistently high/low blood pressure, elevated heart rate, unstable blood glucose).
- Significant negative changes in activity levels (e.g., sudden drop in steps).
- Poor adherence to critical medications, especially if combined with other risk factors or abnormal vitals.
- Any combination of factors that might indicate a worsening condition or increased risk.

Based on your analysis:
1.  Determine if there are any concerning trends (\`isTrendConcerning\`: true/false).
2.  If \`isTrendConcerning\` is true, provide a concise \`trendSummary\` explaining the identified trend and why it's a concern (e.g., "Blood pressure has remained elevated above 145/90 mmHg for the past 3 days, increasing risk of cardiovascular events given patient's history of hypertension.").
3.  If \`isTrendConcerning\` is true, provide a specific, actionable \`suggestedActionForDoctor\` (e.g., "Consider scheduling a telehealth consultation within 48 hours to review blood pressure management," or "Recommend patient increase frequency of blood glucose monitoring and log results for review.").
4.  If no concerning trends are identified, set \`isTrendConcerning\` to false, and \`trendSummary\` and \`suggestedActionForDoctor\` should be null.

Focus on clinically relevant trends that warrant a doctor's attention.
`,
});

const analyzePatientHealthTrendsFlow = ai.defineFlow(
  {
    name: 'analyzePatientHealthTrendsFlow',
    inputSchema: AnalyzePatientHealthTrendsInputSchema,
    outputSchema: AnalyzePatientHealthTrendsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      // Fallback in case the AI fails to produce structured output
      console.warn(`AI failed to produce structured output for analyzePatientHealthTrends for patient ${input.patientId}.`);
      return {
        isTrendConcerning: false,
        trendSummary: 'AI analysis failed to produce a result.',
        suggestedActionForDoctor: null,
      };
    }
    if (!output.isTrendConcerning) {
        output.trendSummary = null;
        output.suggestedActionForDoctor = null;
    }
    return output;
  }
);

