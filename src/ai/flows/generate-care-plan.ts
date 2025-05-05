'use server';
/**
 * @fileOverview Generates a personalized care plan for the patient based on their predicted risks.
 *
 * - generateCarePlan - A function that handles the care plan generation process.
 * - GenerateCarePlanInput - The input type for the generateCarePlan function.
 * - GenerateCarePlanOutput - The return type for the generateCarePlan function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateCarePlanInputSchema = z.object({
  patientId: z.string().describe('The ID of the patient.'),
  predictedRisks: z.string().describe('The predicted risks for the patient.'),
  medicalHistory: z.string().describe('The medical history of the patient.'),
  currentMedications: z.string().describe('The current medications of the patient.'),
});
export type GenerateCarePlanInput = z.infer<typeof GenerateCarePlanInputSchema>;

const GenerateCarePlanOutputSchema = z.object({
  carePlan: z.string().describe('The generated care plan for the patient.'),
});
export type GenerateCarePlanOutput = z.infer<typeof GenerateCarePlanOutputSchema>;

export async function generateCarePlan(input: GenerateCarePlanInput): Promise<GenerateCarePlanOutput> {
  return generateCarePlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCarePlanPrompt',
  input: {
    schema: z.object({
      patientId: z.string().describe('The ID of the patient.'),
      predictedRisks: z.string().describe('The predicted risks for the patient.'),
      medicalHistory: z.string().describe('The medical history of the patient.'),
      currentMedications: z.string().describe('The current medications of the patient.'),
    }),
  },
  output: {
    schema: z.object({
      carePlan: z.string().describe('The generated care plan for the patient.'),
    }),
  },
  prompt: `You are an AI assistant specialized in generating personalized care plans for patients post-discharge. As a doctor, I want you to generate a care plan for patient with ID {{{patientId}}} based on their predicted risks, so I can adjust and approve it to save time and ensure comprehensive post-discharge care.

  Patient Medical History: {{{medicalHistory}}}
  Patient Current Medications: {{{currentMedications}}}
  Predicted Risks: {{{predictedRisks}}}

  Please provide a detailed and actionable care plan.
  `,
});

const generateCarePlanFlow = ai.defineFlow<
  typeof GenerateCarePlanInputSchema,
  typeof GenerateCarePlanOutputSchema
>(
  {
    name: 'generateCarePlanFlow',
    inputSchema: GenerateCarePlanInputSchema,
    outputSchema: GenerateCarePlanOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
