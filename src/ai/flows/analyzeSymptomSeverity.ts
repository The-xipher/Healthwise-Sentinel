
'use server';
/**
 * @fileOverview Analyzes patient-reported symptoms along with their risk profile and vitals
 * to determine an objective severity level and recommend if a critical alert is needed.
 *
 * - analyzeSymptomSeverity - Function to call the AI flow.
 * - AnalyzeSymptomSeverityInput - Input type for the flow.
 * - AnalyzeSymptomSeverityOutput - Output type from the flow.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeSymptomSeverityInputSchema = z.object({
  patientId: z.string().describe('The ID of the patient.'),
  symptomDescription: z.string().describe('The detailed description of symptoms reported by the patient.'),
  patientRiskProfile: z.string().describe('A summary of the patient\'s known risk factors, e.g., "High readmission risk. History of hypertension, Diabetes Type 2."'),
  latestVitals: z.string().describe('A summary of the patient\'s most recent vital signs, e.g., "Heart Rate: 105bpm, Blood Pressure: 150/95 mmHg, Blood Glucose: 180 mg/dL, SpO2: 92%."'),
  manuallySelectedSeverity: z.enum(['mild', 'moderate', 'severe']).describe('The severity level manually selected by the patient.'),
});
export type AnalyzeSymptomSeverityInput = z.infer<typeof AnalyzeSymptomSeverityInputSchema>;

const AnalyzeSymptomSeverityOutputSchema = z.object({
  aiDeterminedSeverity: z.enum(['mild', 'moderate', 'severe']).describe('The severity level determined by the AI analysis.'),
  justification: z.string().describe('The AI\'s reasoning for the determined severity level, highlighting key factors from symptoms, risk profile, and vitals.'),
  isCriticalAlertRecommended: z.boolean().describe('Whether the AI recommends triggering a critical alert based on its assessment (e.g., for emergency services, urgent doctor review).'),
});
export type AnalyzeSymptomSeverityOutput = z.infer<typeof AnalyzeSymptomSeverityOutputSchema>;

export async function analyzeSymptomSeverity(input: AnalyzeSymptomSeverityInput): Promise<AnalyzeSymptomSeverityOutput> {
  return analyzeSymptomSeverityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSymptomSeverityPrompt',
  input: {schema: AnalyzeSymptomSeverityInputSchema},
  output: {schema: AnalyzeSymptomSeverityOutputSchema},
  prompt: `You are an AI clinical decision support assistant. Your role is to analyze patient-reported symptoms in conjunction with their risk profile and latest vital signs to determine an objective severity level.

Patient ID: {{{patientId}}}
Symptom Description Reported by Patient: "{{{symptomDescription}}}"
Patient's Manually Selected Severity: {{{manuallySelectedSeverity}}}

Patient's Known Risk Profile:
{{{patientRiskProfile}}}

Patient's Latest Vital Signs:
{{{latestVitals}}}

Analyze all the provided information carefully.
Based on your analysis:
1.  Determine the objective severity: 'mild', 'moderate', or 'severe'. This may differ from the patient's self-assessment.
2.  Provide a concise justification for your determined severity, mentioning specific symptoms, risks, or vital signs that influenced your decision.
3.  Recommend whether a critical alert is necessary (isCriticalAlertRecommended: true/false). A critical alert implies potential need for immediate medical intervention or emergency services. Recommend a critical alert if the determined severity is 'severe' or if specific combinations of symptoms, risks, and vitals suggest an urgent situation even if overall severity might seem moderate. For example, chest pain in a high-risk cardiac patient, even if described as 'moderate' by the patient, might warrant a critical alert.

Prioritize patient safety. If in doubt, err on the side of caution by recommending a critical alert if there's a significant concern.
If the patient self-selected 'severe', your AI determined severity should also be 'severe' and critical alert recommended should be true, unless there is overwhelming evidence in the description, risk profile, and vitals that this is a gross misjudgment by the patient (which is rare).
If the symptoms are vague or minor, and vitals/risk profile are stable, then 'mild' or 'moderate' with no critical alert is appropriate.
Focus on identifying patterns that indicate a worsening condition or acute event.
`,
});

const analyzeSymptomSeverityFlow = ai.defineFlow(
  {
    name: 'analyzeSymptomSeverityFlow',
    inputSchema: AnalyzeSymptomSeverityInputSchema,
    outputSchema: AnalyzeSymptomSeverityOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      // Fallback in case the AI fails to produce structured output
      console.warn(`AI failed to produce structured output for analyzeSymptomSeverity for patient ${input.patientId}. Defaulting to high alert if patient selected severe.`);
      const patientSelectedSevere = input.manuallySelectedSeverity === 'severe';
      return {
        aiDeterminedSeverity: patientSelectedSevere ? 'severe' : 'moderate',
        justification: patientSelectedSevere ? 'AI output error; defaulting based on patient manual severe selection.' : 'AI output error; defaulting to moderate. Manual review advised.',
        isCriticalAlertRecommended: patientSelectedSevere,
      };
    }
    return output;
  }
);
