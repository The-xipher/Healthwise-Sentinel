
'use server';

import nodemailer from 'nodemailer';

const brevoSmtpHost = process.env.BREVO_SMTP_HOST;
const brevoSmtpPort = process.env.BREVO_SMTP_PORT;
const brevoSmtpUser = process.env.BREVO_SMTP_USER;
const brevoSmtpPass = process.env.BREVO_SMTP_PASS;
const brevoSmtpFromEmail = process.env.BREVO_SMTP_FROM_EMAIL;

if (!brevoSmtpHost || !brevoSmtpPort || !brevoSmtpUser || !brevoSmtpPass || !brevoSmtpFromEmail) {
  console.warn(
    'Brevo SMTP environment variables are not fully configured. Email sending will be disabled.'
  );
}

const transporter = nodemailer.createTransport({
  host: brevoSmtpHost,
  port: parseInt(brevoSmtpPort || '587', 10),
  secure: parseInt(brevoSmtpPort || '587', 10) === 465, 
  auth: {
    user: brevoSmtpUser,
    pass: brevoSmtpPass,
  },
  // Increase timeout to prevent issues with slow SMTP servers
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000, // 10 seconds
  socketTimeout: 10000, // 10 seconds
});

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!brevoSmtpHost || !brevoSmtpPort || !brevoSmtpUser || !brevoSmtpPass || !brevoSmtpFromEmail) {
    console.error('SMTP not configured, cannot send email.');
    return { success: false, error: 'SMTP service is not configured.' };
  }

  try {
    const info = await transporter.sendMail({
      from: brevoSmtpFromEmail,
      ...options,
    });
    console.log('Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending email:', error);
     // More specific error handling for common SMTP issues
    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        return { success: false, error: `SMTP Connection Error: ${error.message}. Check host/port and network.` };
    }
    if (error.responseCode === 550 || error.responseCode === 554) { // Common permanent errors
        return { success: false, error: `SMTP Relay Error (Code ${error.responseCode}): ${error.message}. Check 'From' address authorization.` };
    }
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendWelcomeEmail(to: string, displayName: string, temporaryPassword: string, role: 'patient' | 'doctor' | 'admin'): Promise<{ success: boolean; error?: string }> {
  const subject = 'Welcome to HealthWise Hub!';
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/login`;
  const text = `
Hello ${displayName},

Welcome to HealthWise Hub! Your account as a ${role} has been created.

You can log in using:
Email: ${to}
Temporary Password: ${temporaryPassword}

Please log in at: ${loginUrl}

Upon your first login, you will be required to change your temporary password for security reasons.

If you have any questions, please contact support.

Regards,
The HealthWise Hub Team
  `;
  const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Hello ${displayName},</h2>
  <p>Welcome to <strong>HealthWise Hub</strong>! Your account as a <strong>${role}</strong> has been created.</p>
  <p>You can log in using the following credentials:</p>
  <ul>
    <li><strong>Email:</strong> ${to}</li>
    <li><strong>Temporary Password:</strong> ${temporaryPassword}</li>
  </ul>
  <p>Please log in at: <a href="${loginUrl}" style="color: #10b981; text-decoration: none;">${loginUrl}</a></p>
  <p><strong>Important:</strong> Upon your first login, you will be required to change your temporary password for security reasons.</p>
  <p>If you have any questions, please contact our support team.</p>
  <br>
  <p>Regards,<br>The HealthWise Hub Team</p>
</div>
  `;

  return sendEmail({ to, subject, text, html });
}


export async function sendSevereSymptomAlertEmail(
  to: string, 
  patientName: string, 
  symptomDescription: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `URGENT Health Alert for Patient: ${patientName}`;
  const text = `
Dear Emergency Contact,

This is an URGENT health alert regarding patient ${patientName}.

They have recently reported SEVERE symptoms described as:
"${symptomDescription}"

Please check on ${patientName} immediately. Consider contacting their doctor or emergency medical services if necessary.

This is an automated alert from the HealthWise Hub system.

Sincerely,
The HealthWise Hub Team
  `;
  const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; border: 2px solid #ef4444; padding: 20px; border-radius: 8px; background-color: #fee2e2;">
  <h2 style="color: #b91c1c;">URGENT Health Alert</h2>
  <p>Dear Emergency Contact,</p>
  <p>This is an URGENT health alert regarding patient <strong>${patientName}</strong>.</p>
  <p>They have recently reported SEVERE symptoms described as:</p>
  <blockquote style="border-left: 4px solid #f87171; padding-left: 10px; margin-left: 0; font-style: italic;">
    "${symptomDescription}"
  </blockquote>
  <p><strong>Please check on ${patientName} immediately.</strong> Consider contacting their doctor or emergency medical services if necessary.</p>
  <p>This is an automated alert from the HealthWise Hub system.</p>
  <br>
  <p>Sincerely,<br>The HealthWise Hub Team</p>
</div>
  `;

  return sendEmail({ to, subject, text, html });
}
