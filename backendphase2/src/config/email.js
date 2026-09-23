import { Resend } from 'resend';
import { env } from './env.js';
import { getDefaultEmailFrom, getEmailFromForTrigger } from './emailFromAddresses.js';

let resendClient = null;
function getResend() {
  if (resendClient) return resendClient;
  const key = String(env.RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!key) {
    throw new Error('Email service not configured (RESEND_API_KEY)');
  }
  resendClient = new Resend(key);
  return resendClient;
}

/** Created on first send so unit tests can import this module without RESEND_API_KEY. */
export const resend = new Proxy(
  {},
  {
    get(_target, property) {
      const client = getResend();
      const value = client[property];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  },
);

export const getEmailFrom = (triggerId) => {
  if (triggerId) return getEmailFromForTrigger(triggerId);
  return getDefaultEmailFrom();
};

export { getEmailFromForTrigger };
