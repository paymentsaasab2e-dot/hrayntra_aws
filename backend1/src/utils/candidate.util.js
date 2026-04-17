const crypto = require('crypto');

/**
 * Generate a unique, deterministic ID based on WhatsApp number
 * This ensures the same WhatsApp number always gets the same ID
 * 
 * @param {string} whatsappNumber - Full WhatsApp number with country code (e.g., "+911234567890")
 * @returns {string} A 24-character hex string compatible with MongoDB ObjectId format
 */
function generateCandidateId(whatsappNumber) {
  // Normalize the WhatsApp number (remove spaces, ensure consistent format)
  const normalized = whatsappNumber.replace(/\s+/g, '').trim();
  
  // Create a hash of the WhatsApp number
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  
  // Take first 24 characters to match MongoDB ObjectId format (24 hex characters)
  // This ensures uniqueness while maintaining ObjectId compatibility
  return hash.substring(0, 24);
}

/**
 * Validate if a string is a valid MongoDB ObjectId format (24 hex characters)
 */
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

module.exports = {
  generateCandidateId,
  isValidObjectId,
};
