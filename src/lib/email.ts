
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
  secure: parseInt(brevoSmtpPort || '587', 10) === 465, // true for 465, false for other ports
  auth: {
    user: brevoSmtpUser,
    pass: brevoSmtpPass,
  },
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

Upon your first login, we strongly recommend changing your temporary password via your profile page for security reasons.

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
  <p>Please log in at: <a href="${loginUrl}" style="color: #A7DBD8; text-decoration: none;">${loginUrl}</a></p>
  <p><strong>Important:</strong> Upon your first login, we strongly recommend changing your temporary password via your profile page for security reasons.</p>
  <p>If you have any questions, please contact our support team.</p>
  <br>
  <p>Regards,<br>The HealthWise Hub Team</p>
</div>
  `;

  return sendEmail({ to, subject, text, html });
}
