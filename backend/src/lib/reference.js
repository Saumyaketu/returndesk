const crypto = require('crypto');

/**
 * Human-Readable Reference Generator for ReturnDesk
 * 
 * Requirement:
 * "Every request carries a unique, human-readable reference that the system generates itself.
 * The person raising the request never types it in."
 * 
 * Format: RET-YYYYMM-XXXXX (e.g. RET-202611-7KB49)
 * Character set avoids visually ambiguous characters: 0, O, 1, I, L.
 */
const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateRandomSuffix(length = 5) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

function generateReference(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const suffix = generateRandomSuffix(5);
  return `RET-${year}${month}-${suffix}`;
}

const REFERENCE_REGEX = /^RET-\d{6}-[2-9A-HJ-NP-Z]{5}$/;

function isValidReference(ref) {
  return typeof ref === 'string' && REFERENCE_REGEX.test(ref);
}

module.exports = {
  generateReference,
  isValidReference,
  REFERENCE_REGEX,
};
