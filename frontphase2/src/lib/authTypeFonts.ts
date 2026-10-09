/**
 * Auth / login typefaces without next/font/google.
 * Google Fonts downloads fail in Docker builds (offline / firewall) and crash next build.
 * Prefer DM Sans when available at runtime; fall back to system UI otherwise.
 */
export const authDmSansClass = 'auth-dm-sans-font';
