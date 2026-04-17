import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';

/**
 * Generate a loginId from first and last name
 * Format: firstname.lastname@saasa
 * If taken, append incrementing number (e.g., alex.thompson2@saasa)
 */
export async function generateLoginId(firstName, lastName) {
  // Handle empty names
  const first = (firstName || '').toLowerCase().trim();
  const last = (lastName || '').toLowerCase().trim();
  
  if (!first && !last) {
    throw new Error('First name or last name is required to generate loginId');
  }
  
  // Use first name + last name, or just first name, or generate from email
  const baseLoginId = last ? `${first}.${last}@saasa` : `${first}@saasa`;
  
  // Check if base loginId exists
  const existing = await prisma.userCredential.findUnique({
    where: { loginId: baseLoginId },
  });

  if (!existing) {
    return baseLoginId;
  }

  // If exists, try with numbers
  let counter = 2;
  let loginId = last ? `${first}.${last}${counter}@saasa` : `${first}${counter}@saasa`;
  
  while (true) {
    const exists = await prisma.userCredential.findUnique({
      where: { loginId },
    });
    
    if (!exists) {
      return loginId;
    }
    
    counter++;
    loginId = last ? `${first}.${last}${counter}@saasa` : `${first}${counter}@saasa`;
    
    // Safety limit
    if (counter > 1000) {
      throw new Error('Unable to generate unique loginId');
    }
  }
}

/**
 * Generate a random secure temporary password
 * 12 characters: mix of uppercase, lowercase, numbers, and special characters
 */
export function generateTempPassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Hash a password using bcrypt with salt rounds 12
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

/**
 * Generate a random invite token using crypto.randomBytes
 */
export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate invite expiry date - 48 hours from now
 */
export function calculateInviteExpiry() {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 48);
  return expiry;
}

/**
 * Get invite expiry date - hours from now (default 48)
 */
export function getInviteExpiry(hoursFromNow = 48) {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hoursFromNow);
  return expiry;
}