import { Resend } from 'resend';
import { env } from './env.js';
import { getDefaultEmailFrom, getEmailFromForTrigger } from './emailFromAddresses.js';

export const resend = new Resend(env.RESEND_API_KEY);

export const getEmailFrom = (triggerId) => {
  if (triggerId) return getEmailFromForTrigger(triggerId);
  return getDefaultEmailFrom();
};

export { getEmailFromForTrigger };
