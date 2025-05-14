
'use server';
/**
 * @fileOverview Suggests an appointment for a high-risk patient.
 *
 * - suggestAppointmentForHighRiskPatient - A function that suggests an appointment.
 * - SuggestAppointmentInput - The input type for the function.
 * - SuggestAppointmentOutput - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

export const SuggestAppointmentInputSchema = z.object({
  patientId: z.string().describe('The ID of the patient.'),
  patientName: z.string().describe('The name of the patient.'),
  readmissionRisk: z.enum(['low', 'medium', 'high']).describe('The readmission risk level of the patient.'),
  doctorId: z.string().describe('The ID of the doctor.'),
  doctorName: z.string().describe('The name of the doctor.'),
});
export type SuggestAppointmentInput = z.infer<typeof SuggestAppointmentInputSchema>;

export const SuggestAppointmentOutputSchema = z.object({
  suggestion: z.object({
    appointmentReason: z.string().describe('The suggested reason for the appointment.'),
    proposedTimeframe: z.string().describe('A human-readable suggested timeframe for the appointment (e.g., "within 3 days", "next week").'),
    patientId: z.string(),
    patientName: z.string(),
    doctorId: z.string(),
    doctorName: z.string(),
  }).nullable().describe('The appointment suggestion, or null if no appointment is deemed necessary by the AI.'),
});
export type SuggestAppointmentOutput = z.infer<typeof SuggestAppointmentOutputSchema>;

export async function suggestAppointmentForHighRiskPatient(input: SuggestAppointmentInput): Promise<SuggestAppointmentOutput> {
  return suggestAppointmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestAppointmentPrompt',
  input: {schema: SuggestAppointmentInputSchema},
  output: {schema: SuggestAppointmentOutputSchema},
  prompt: `You are an AI assistant helping doctors manage high-risk patients.
Patient Name: {{{patientName}}} (ID: {{{patientId}}})
Assigned Doctor: {{{doctorName}}} (ID: {{{doctorId}}})
Current Readmission Risk: {{{readmissionRisk}}}

If the patient's readmission risk is 'high', suggest an urgent follow-up appointment.
The reason should be concise and related to managing high readmission risk.
The proposed timeframe should be for an appointment soon, e.g., "within 3 days" or "as soon as possible".

If the risk is not 'high', you should return null for the suggestion.

Example for high risk:
{
  "suggestion": {
    "appointmentReason": "Urgent follow-up due to high readmission risk. Review care plan and vital signs.",
    "proposedTimeframe": "Within the next 3 business days",
    "patientId": "{{{patientId}}}",
    "patientName": "{{{patientName}}}",
    "doctorId": "{{{doctorId}}}",
    "doctorName": "{{{doctorName}}}"
  }
}

Example for medium or low risk:
{
  "suggestion": null
}
`,
});

const suggestAppointmentFlow = ai.defineFlow(
  {
    name: 'suggestAppointmentFlow',
    inputSchema: SuggestAppointmentInputSchema,
    outputSchema: SuggestAppointmentOutputSchema,
  },
  async (input) => {
    if (input.readmissionRisk !== 'high') {
      return { suggestion: null };
    }
    const {output} = await prompt(input);
    // Ensure the output structure matches even if LLM deviates slightly for high risk
    if (output?.suggestion) {
        return {
            suggestion: {
                ...output.suggestion,
                patientId: input.patientId,
                patientName: input.patientName,
                doctorId: input.doctorId,
                doctorName: input.doctorName,
            }
        };
    }
    // Fallback if LLM fails to provide suggestion for high risk (should be rare with good prompt)
    return { 
        suggestion: {
            appointmentReason: `Follow-up for high-risk patient ${input.patientName}.`,
            proposedTimeframe: "Within 3-5 days",
            patientId: input.patientId,
            patientName: input.patientName,
            doctorId: input.doctorId,
            doctorName: input.doctorName,
        }
    };
  }
);
