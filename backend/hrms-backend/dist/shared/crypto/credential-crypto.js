"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptCredential = encryptCredential;
exports.decryptCredential = decryptCredential;
exports.generateSecurePassword = generateSecurePassword;
const crypto_1 = __importDefault(require("crypto"));
const ALGO = 'aes-256-gcm';
const KEY = crypto_1.default
    .createHash('sha256')
    .update(process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-insecure-key')
    .digest();
function encryptCredential(plain) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGO, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}
function decryptCredential(payload) {
    try {
        const [ivB64, tagB64, dataB64] = payload.split(':');
        if (!ivB64 || !tagB64 || !dataB64)
            return null;
        const decipher = crypto_1.default.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(dataB64, 'base64')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    }
    catch {
        return null;
    }
}
function generateSecurePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = crypto_1.default.randomBytes(length);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
//# sourceMappingURL=credential-crypto.js.map