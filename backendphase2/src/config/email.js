import { Resend } from 'resend';
import { env } from './env.js';

export const resend = new Resend(env.RESEND_API_KEY);

export const getEmailFrom = () => {
  return env.RESEND_FROM_EMAIL || env.EMAIL_FROM || 'onboarding@resend.dev';
};
