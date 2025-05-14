'use server';

/**
 * @fileOverview An AI agent that summarizes a patient's medical history.
 *
 * - summarizePatientHistory - A function that handles the summarization process.
 * - SummarizePatientHistoryInput - The input type for the summarizePatientHistory function.
 * - SummarizePatientHistoryOutput - The return type for the summarizePatientHistory function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SummarizePatientHistoryInputSchema = z.object({
  patientId: z.string().describe('The ID of the patient whose history needs to be summarized.'),
  medicalHistory: z.string().describe('The patient medical history to be summarized.'),
});
export type SummarizePatientHistoryInput = z.infer<typeof SummarizePatientHistoryInputSchema>;

const SummarizePatientHistoryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the patient medical history.'),
});
export type SummarizePatientHistoryOutput = z.infer<typeof SummarizePatientHistoryOutputSchema>;

export async function summarizePatientHistory(
  input: SummarizePatientHistoryInput
): Promise<SummarizePatientHistoryOutput> {
  return summarizePatientHistoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizePatientHistoryPrompt',
  input: {
    schema: SummarizePatientHistoryInputSchema, // Use the internal schema
  },
  output: {
    schema: SummarizePatientHistoryOutputSchema, // Use the internal schema
  },
  prompt: `You are an AI assistant helping doctors quickly understand a patient\'s medical history.

  Summarize the following medical history for patient ID {{{patientId}}}.  The summary should be concise and highlight the most important details for a doctor making treatment decisions.

  Medical History: {{{medicalHistory}}} `,
});

const summarizePatientHistoryFlow = ai.defineFlow<
  SummarizePatientHistoryInput, // Use the exported type
  SummarizePatientHistoryOutput // Use the exported type
>(
  {
    name: 'summarizePatientHistoryFlow',
    inputSchema: SummarizePatientHistoryInputSchema,
    outputSchema: SummarizePatientHistoryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
