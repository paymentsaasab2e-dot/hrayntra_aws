import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(projectRoot, '.env') });

/**
 * Base URL for the employers SPA (emails, invite links). Reads several env aliases used in deployment.
 * Production must set one of: FRONTEND_URL, CLIENT_URL, NEXT_PUBLIC_APP_URL, APP_PUBLIC_URL, EMPLOYERS_APP_URL.
 */
export function resolvePublicFrontendUrl() {
  const keys = [
    'FRONTEND_URL',
    'CLIENT_URL',
    'NEXT_PUBLIC_APP_URL',
    'APP_PUBLIC_URL',
    'PUBLIC_APP_URL',
    'EMPLOYERS_APP_URL',
    'PHASE2_FRONTEND_URL',
  ];
  for (const key of keys) {
    const v = process.env[key];
    if (v != null && String(v).trim()) {
      return String(v).trim().replace(/\/+$/, '');
    }
  }
  return 'http://localhost:3001';
}

const publicFrontendUrl = resolvePublicFrontendUrl();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5001', 10),
  DATABASE_URL: process.env.DATABASE_URL,
  HEADQUARTERS_DATABASE_URL: process.env.HEADQUARTERS_DATABASE_URL,
  /** Job portal Mongo URL (applications + portal candidates). Falls back to DATABASE_URL when unset. */
  JOB_PORTAL_DATABASE_URL: process.env.JOB_PORTAL_DATABASE_URL,
  /** Shared secret for POST /api/v1/internal/sync-portal-application */
  PHASE2_PORTAL_SYNC_SECRET: process.env.PHASE2_PORTAL_SYNC_SECRET,
  /**
   * Base URL of backend1 (the job portal API). Used to push candidate-facing
   * bell notifications (interview scheduled, candidate rejected, etc.) back
   * into the portal via POST /api/internal/portal-notification. Falls back
   * to the typical local-dev port so a fresh clone "just works".
   */
  JOB_PORTAL_API_URL:
    process.env.JOB_PORTAL_API_URL ||
    process.env.BACKEND1_API_URL ||
    process.env.PORTAL_API_URL ||
    'http://localhost:5000',
  
  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  // Set to 10 years (3650 days) - token will only be invalidated if user is removed from database
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '3650d',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '3650d',
  
  // Legacy JWT support (for backward compatibility)
  JWT_SECRET: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES || process.env.JWT_EXPIRES_IN || '3650d',
  REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES || process.env.REFRESH_TOKEN_EXPIRES_IN || '3650d',
  
  // Resend Email
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM,
  RESEND_TEMPLATE_AUTH_OTP: process.env.RESEND_TEMPLATE_AUTH_OTP,
  EMAIL_FROM: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev',
  
  // Frontend (invite emails, OAuth UI redirects — must match deployed employers app URL in production)
  FRONTEND_URL: publicFrontendUrl,
  CLIENT_URL: publicFrontendUrl,
  BACKEND_PUBLIC_URL:
    process.env.BACKEND_PUBLIC_URL ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}`,
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  
  // Gemini API
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  
  // Anthropic Claude API
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  
  // Social Media APIs
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI:
    process.env.LINKEDIN_REDIRECT_URI ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}/api/v1/linkedin/auth/linkedin/callback`,
  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID,
  FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET,
  TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID || process.env.TWITTER_API_KEY,
  TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET || process.env.TWITTER_API_SECRET,
  
  // Encryption
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // OAuth state JWT (fallback: JWT_ACCESS_SECRET)
  OAUTH_STATE_SECRET: process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET,

  // Google OAuth (Gmail + Calendar)
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}/api/v1/oauth/google/callback`,

  // Microsoft OAuth (Outlook + Teams)
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || process.env.MS_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || process.env.MS_CLIENT_SECRET,
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID || process.env.MS_TENANT_ID || 'common',
  MICROSOFT_REDIRECT_URI:
    process.env.MICROSOFT_REDIRECT_URI ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}/api/v1/oauth/microsoft/callback`,

  // LinkedIn OAuth (register this callback URL in LinkedIn app)
  LINKEDIN_OAUTH_REDIRECT_URI:
    process.env.LINKEDIN_OAUTH_REDIRECT_URI ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}/api/v1/oauth/linkedin/callback`,

  // Interview meeting providers
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
  ZOOM_REDIRECT_URI:
    process.env.ZOOM_REDIRECT_URI ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}/api/v1/auth/zoom/callback`,
  MS_TENANT_ID: process.env.MS_TENANT_ID,
  MS_CLIENT_ID: process.env.MS_CLIENT_ID,
  MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET,
  TWITTER_REDIRECT_URI:
    process.env.TWITTER_REDIRECT_URI ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}/api/v1/auth/twitter/callback`,
  FACEBOOK_REDIRECT_URI:
    process.env.FACEBOOK_REDIRECT_URI ||
    `http://localhost:${parseInt(process.env.PORT || '5001', 10)}/api/v1/auth/facebook/callback`,

  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,

  // SMTP / notifications
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  // AI summary + in-app assistant chat
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  /** Optional; default gpt-4o-mini in assistantChat.service */
  OPENAI_ASSISTANT_MODEL: process.env.OPENAI_ASSISTANT_MODEL,
  /** If "true", assistant DB tools ignore role scoping (single-tenant / demo only). */
  ASSISTANT_FULL_DB_ACCESS: process.env.ASSISTANT_FULL_DB_ACCESS,
};
