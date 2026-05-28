import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveOpenAiChatModel,
  ALLOWED_OPENAI_CHAT_MODEL,
} from './openaiModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const OPENAI_CHAT_MODEL = resolveOpenAiChatModel();

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
  /**
   * Shared Phase 1 candidate snapshots (`candidatecommon` Mongo DB).
   * Falls back to same host as DATABASE_URL with db name `candidatecommon`.
   */
  CANDIDATE_COMMON_DATABASE_URL: process.env.CANDIDATE_COMMON_DATABASE_URL,
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

  /** Enterprise single active session (one login per user). */
  SINGLE_ACTIVE_SESSION_ENABLED:
    process.env.SINGLE_ACTIVE_SESSION_ENABLED !== 'false' &&
    process.env.SINGLE_ACTIVE_SESSION_ENABLED !== '0',
  SESSION_INACTIVITY_MS: parseInt(process.env.SESSION_INACTIVITY_MS || String(5 * 60 * 1000), 10),
  SESSION_INACTIVITY_WARNING_MS: parseInt(
    process.env.SESSION_INACTIVITY_WARNING_MS || String(60 * 1000),
    10,
  ),
  SESSION_TRANSFER_TTL_MS: parseInt(process.env.SESSION_TRANSFER_TTL_MS || String(5 * 60 * 1000), 10),
  
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
  
  // AWS S3 (uploads — replaces Cloudinary)
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  /**
   * First segment after `uploads/` (default `phase2`). Keys: uploads/{phase}/tenants/{tenant}/jobportal/…
   * Tenant comes from JWT / x-tenant-db-name / request context — not from this env var.
   */
  AWS_S3_APP_FOLDER: process.env.AWS_S3_APP_FOLDER || 'phase2',
  /** Optional object ACL (e.g. public-read); use `none` to omit (BucketOwnerEnforced + bucket policy). */
  AWS_S3_UPLOAD_ACL: process.env.AWS_S3_UPLOAD_ACL || '',

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

  /**
   * Comma-separated emails allowed for all HQ APIs (list tenants, provision, assign plan, delete).
   * Defaults to the seeded HRYANTRA platform super admin. Override to add more operators, or set
   * explicitly in .env for staging/production.
   */
  HRAYNTRA_PLATFORM_PROVISION_EMAILS:
    process.env.HRAYNTRA_PLATFORM_PROVISION_EMAILS || 'admin@gmail.com',

  // AI — OpenAI primary model comes from OPENAI_CHAT_MODEL; Mistral fallback when OpenAI fails.
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  /** Resolved chat model from OPENAI_CHAT_MODEL / OPENAI_ASSISTANT_MODEL (defaults to gpt-4.1). */
  OPENAI_CHAT_MODEL,
  OPENAI_ASSISTANT_MODEL: OPENAI_CHAT_MODEL,
  ALLOWED_OPENAI_CHAT_MODEL,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  MISTRAL_CHAT_MODEL: process.env.MISTRAL_CHAT_MODEL || 'mistral-small-latest',
  MISTRAL_API_BASE_URL: process.env.MISTRAL_API_BASE_URL || 'https://api.mistral.ai/v1',
  /** If "true", assistant DB tools ignore role scoping (single-tenant / demo only). */
  ASSISTANT_FULL_DB_ACCESS: process.env.ASSISTANT_FULL_DB_ACCESS,

  /**
   * Max upload size for resume/CV routes (parse-resume, bulk-cv, candidate resume file).
   * Default 25MB. Set RESUME_MAX_FILE_BYTES in .env to override (bytes).
   */
  RESUME_MAX_FILE_BYTES: (() => {
    const raw = process.env.RESUME_MAX_FILE_BYTES;
    if (raw != null && String(raw).trim() !== '') {
      const n = parseInt(String(raw).trim(), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 25 * 1024 * 1024;
  })(),

  /** Max CV count per bulk session (ZIP expand or client queue). Default 2000. */
  BULK_CV_MAX_FILES: (() => {
    const raw = process.env.BULK_CV_MAX_FILES;
    if (raw != null && String(raw).trim() !== '') {
      const n = parseInt(String(raw).trim(), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 2000;
  })(),

  /** Max ZIP upload size for bulk CV archive. Default 2GB. */
  BULK_CV_MAX_ZIP_BYTES: (() => {
    const raw = process.env.BULK_CV_MAX_ZIP_BYTES;
    if (raw != null && String(raw).trim() !== '') {
      const n = parseInt(String(raw).trim(), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 2 * 1024 * 1024 * 1024;
  })(),
};

export { OPENAI_CHAT_MODEL, ALLOWED_OPENAI_CHAT_MODEL };
