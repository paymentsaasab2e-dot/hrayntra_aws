import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5001', 10),
  DATABASE_URL: process.env.DATABASE_URL,
  
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
  
  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3001',
  CLIENT_URL: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3001',
  
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
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/auth/linkedin/callback',
  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  
  // Encryption
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // Interview meeting providers
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
  MS_TENANT_ID: process.env.MS_TENANT_ID,
  MS_CLIENT_ID: process.env.MS_CLIENT_ID,
  MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET,

  // SMTP / notifications
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  // AI summary
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
