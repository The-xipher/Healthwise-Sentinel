
// @fileOverview Generate suggested interventions based on patient data and risk predictions.
//
// - generateSuggestedInterventions - A function that generates suggested interventions for a patient.
// - GenerateSuggestedInterventionsInput - The input type for the generateSuggestedInterventions function.
// - GenerateSuggestedInterventionsOutput - The return type for the generateSuggestedInterventions function.

'use server';

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateSuggestedInterventionsInputSchema = z.object({
  patientHealthData: z
    .string()
    .describe("The patient's health data, including vital signs (like heart rate, blood pressure, glucose levels), medication list and adherence, and self-reported symptoms."),
  riskPredictions: z
    .string()
    .describe('AI-generated risk predictions for the patient, including readmission risk and potential complications.'),
});
export type GenerateSuggestedInterventionsInput = z.infer<
  typeof GenerateSuggestedInterventionsInputSchema
>;

const GenerateSuggestedInterventionsOutputSchema = z.object({
  suggestedInterventions: z
    .string()
    .describe('A list of suggested interventions based on the patient data and risk predictions, considering their medications and vitals.'),
});
export type GenerateSuggestedInterventionsOutput = z.infer<
  typeof GenerateSuggestedInterventionsOutputSchema
>;

export async function generateSuggestedInterventions(
  input: GenerateSuggestedInterventionsInput
): Promise<GenerateSuggestedInterventionsOutput> {
  return generateSuggestedInterventionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSuggestedInterventionsPrompt',
  input: {
    schema: GenerateSuggestedInterventionsInputSchema,
  },
  output: {
    schema: GenerateSuggestedInterventionsOutputSchema,
  },
  prompt: `You are an AI assistant specialized in generating suggested interventions for patients based on their health data and risk predictions. Your suggestions should be tailored to the individual's specific situation.

  Consider the following patient health data:
  {{patientHealthData}}
  This data includes details about their current vital signs, medications they are taking, medication adherence percentages, and any symptoms they have recently reported.

  Also, consider these AI-generated risk predictions:
  {{riskPredictions}}

  Based on ALL of this information, generate a list of specific, actionable, and personalized interventions. These interventions should help the doctor improve the patient's health outcomes.
  For example, if a patient is on a specific medication, suggest interventions that are compatible with it or address potential side effects. If vital signs are trending in a certain direction, suggest relevant actions.
  The interventions should be clear, concise, and easy for a doctor to understand and implement.
  Focus on lifestyle adjustments, medication reminders or clarifications (do not suggest changing dosages or medications themselves, but rather adherence or understanding), and potential follow-up actions.
  `,
});

const generateSuggestedInterventionsFlow = ai.defineFlow<
  GenerateSuggestedInterventionsInput,
  GenerateSuggestedInterventionsOutput
>({
  name: 'generateSuggestedInterventionsFlow',
  inputSchema: GenerateSuggestedInterventionsInputSchema,
  outputSchema: GenerateSuggestedInterventionsOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});

