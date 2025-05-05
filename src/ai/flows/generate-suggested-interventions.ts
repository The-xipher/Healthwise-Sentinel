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
    .describe("The patient's health data, including vital signs, medication adherence, and self-reported symptoms."),
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
    .describe('A list of suggested interventions based on the patient data and risk predictions.'),
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
    schema: z.object({
      patientHealthData: z
        .string()
        .describe("The patient's health data, including vital signs, medication adherence, and self-reported symptoms."),
      riskPredictions: z
        .string()
        .describe('AI-generated risk predictions for the patient, including readmission risk and potential complications.'),
    }),
  },
  output: {
    schema: z.object({
      suggestedInterventions: z
        .string()
        .describe('A list of suggested interventions based on the patient data and risk predictions.'),
    }),
  },
  prompt: `You are an AI assistant specialized in generating suggested interventions for patients based on their health data and risk predictions.

  Based on the following patient health data:
  {{patientHealthData}}

  And the following risk predictions:
  {{riskPredictions}}

  Generate a list of suggested interventions that the doctor can use to improve the patient's health outcomes.
  The interventions should be clear, concise, and actionable.
  `,
});

const generateSuggestedInterventionsFlow = ai.defineFlow<
  typeof GenerateSuggestedInterventionsInputSchema,
  typeof GenerateSuggestedInterventionsOutputSchema
>({
  name: 'generateSuggestedInterventionsFlow',
  inputSchema: GenerateSuggestedInterventionsInputSchema,
  outputSchema: GenerateSuggestedInterventionsOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});
