import nodemailer from 'nodemailer';
import { env } from './env';

/**
 * Nodemailer SMTP transporter configured for Mailtrap in development.
 *
 * In production, you only need to swap the SMTP_* environment variables
 * (e.g., AWS SES, Postmark, or SendGrid SMTP) — no code changes required.
 */
export const mailer = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends a single plain-text email using the configured transporter.
 * Throws if SMTP credentials are missing or the mail server rejects the message.
 */
export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<void> {
  await mailer.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
  });
}
