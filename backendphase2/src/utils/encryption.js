import crypto from 'crypto';

// Get encryption key from env or generate one (for development only)
// AES-256-GCM requires a 32-byte (256-bit) key
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // If key is provided as hex string, it should be 64 characters (32 bytes * 2)
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    // If key is provided as a string, hash it to get 32 bytes
    return crypto.createHash('sha256').update(envKey).digest();
  }
  
  // For development: generate a key and log it so user can add to .env
  const generatedKey = crypto.randomBytes(32);
  const keyHex = generatedKey.toString('hex');
  console.warn('\n⚠️  WARNING: ENCRYPTION_KEY not set in .env file!');
  console.warn('Generated temporary key for this session. Add this to your .env file:');
  console.warn(`ENCRYPTION_KEY=${keyHex}\n`);
  
  return generatedKey;
}

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';

export const encryption = {
  encrypt(text) {
    if (!text) {
      throw new Error('Cannot encrypt empty text');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  },

  decrypt(encryptedData) {
    if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
      throw new Error('Invalid encrypted data format');
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  },

  // Helper to encrypt token for storage
  encryptToken(token) {
    if (!token) {
      throw new Error('Cannot encrypt empty token');
    }
    const encrypted = this.encrypt(token);
    return JSON.stringify(encrypted);
  },

  // Helper to decrypt token from storage
  decryptToken(encryptedTokenString) {
    if (!encryptedTokenString) {
      throw new Error('Cannot decrypt empty token string');
    }
    try {
      const encrypted = JSON.parse(encryptedTokenString);
      return this.decrypt(encrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt token: ${error.message}`);
    }
  },

  /**
   * AES-256-GCM as single string: ivHex:authTagHex:cipherHex (for API keys / secrets fields).
   */
  encryptColonString(plain) {
    if (plain == null || plain === '') return '';
    const text = String(plain);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  },

  decryptColonString(stored) {
    if (stored == null || stored === '') return '';
    const s = String(stored);
    const parts = s.split(':');
    if (parts.length !== 3) return '';
    const [ivHex, authTagHex, encHex] = parts;
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let out = decipher.update(encHex, 'hex', 'utf8');
      out += decipher.final('utf8');
      return out;
    } catch {
      return '';
    }
  },
};
