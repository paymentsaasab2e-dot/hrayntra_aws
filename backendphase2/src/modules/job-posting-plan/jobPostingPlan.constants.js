/** Freemium job-posting plan (SRS v1.1) — new module; does not replace HQ package maxJobs. */

export const JOB_POSTING_PLAN_SETTING_KEY = 'job_posting_plan_v1';
export const JOB_POSTING_USAGE_SETTING_KEY = 'job_posting_usage_v1';

export const FREE_MONTHLY_PUBLISH_LIMIT = Number(process.env.JOB_POSTING_FREE_LIMIT || 10) || 10;
export const PREMIUM_MONTHLY_PUBLISH_LIMIT =
  Number(process.env.JOB_POSTING_PREMIUM_LIMIT || 50) || 50;

/** INR paise for Premium monthly (default ₹999). Override via env. */
export const PREMIUM_MONTHLY_PRICE_PAISE =
  Number(process.env.JOB_POSTING_PREMIUM_PRICE_PAISE || 99900) || 99900;

export const PREMIUM_YEARLY_PRICE_PAISE =
  Number(process.env.JOB_POSTING_PREMIUM_YEARLY_PRICE_PAISE || 999000) || 999000;

export const QUOTA_ERROR_CODE = 'JOB_POSTING_QUOTA_EXCEEDED';
