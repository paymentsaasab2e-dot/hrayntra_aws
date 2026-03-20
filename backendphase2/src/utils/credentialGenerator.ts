import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';

/**
 * Generate a unique loginId from first and last name
 * Format: firstname.lastname@saasa
 * Strips spaces and special characters, checks for uniqueness
 */
export async function generateLoginId(
  firstName: string,
  lastName: string,
  prismaClient: typeof prisma = prisma
): Promise<string> {
  // Strip spaces and special characters, convert to lowercase
  const clean = (str: string): string => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, ''); // Remove all non-alphanumeric characters
  };

  const first = clean(firstName || '');
  const last = clean(lastName || '');

  if (!first && !last) {
    throw new Error('First name or last name is required to generate loginId');
  }

  // Build base loginId
  const baseLoginId = last ? `${first}.${last}@saasa` : `${first}@saasa`;

  // Check if base loginId exists
  const existing = await prismaClient.userCredential.findUnique({
    where: { loginId: baseLoginId },
  });

  if (!existing) {
    return baseLoginId;
  }

  // If exists, try with numbers 2, 3, 4, etc.
  let counter = 2;
  let loginId = last ? `${first}.${last}${counter}@saasa` : `${first}${counter}@saasa`;

  while (true) {
    const exists = await prismaClient.userCredential.findUnique({
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
 * Uses crypto.randomBytes for randomness
 */
export function generateTempPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  // Generate random bytes for each character
  const randomBytes = crypto.randomBytes(12);
  const password: string[] = [];

  // Ensure at least one of each type
  const randomUpperIndex = randomBytes[0] % uppercase.length;
  const randomLowerIndex = randomBytes[1] % lowercase.length;
  const randomNumberIndex = randomBytes[2] % numbers.length;
  const randomSpecialIndex = randomBytes[3] % special.length;

  password.push(uppercase[randomUpperIndex]);
  password.push(lowercase[randomLowerIndex]);
  password.push(numbers[randomNumberIndex]);
  password.push(special[randomSpecialIndex]);

  // Fill the rest randomly using crypto.randomBytes
  for (let i = 4; i < 12; i++) {
    const randomIndex = randomBytes[i] % allChars.length;
    password.push(allChars[randomIndex]);
  }

  // Shuffle the password array using Fisher-Yates shuffle with crypto randomness
  for (let i = password.length - 1; i > 0; i--) {
    const randomBytesForShuffle = crypto.randomBytes(1);
    const j = randomBytesForShuffle[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

/**
 * Hash a password using bcrypt with salt rounds 12
 */
export async function hashPassword(plainText: string): Promise<string> {
  return await bcrypt.hash(plainText, 12);
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(
  plainText: string,
  hashed: string
): Promise<boolean> {
  return await bcrypt.compare(plainText, hashed);
}

/**
 * Generate a random invite token using crypto.randomBytes
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate invite expiry date
 * @param hoursFromNow - Number of hours from now (default: 48)
 */
export function getInviteExpiry(hoursFromNow: number = 48): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hoursFromNow);
  return expiry;
}
