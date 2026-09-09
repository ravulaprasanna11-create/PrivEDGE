/**
 * PRIVEDGE Phase 1: Local Privacy Core - Independent Outbound Validator
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Independently validates outbound context payloads before network transmission.
 * Must fail closed. Does NOT trust sanitization flags.
 * NEVER logs or exposes raw PII.
 */

import type { SanitizedContext, ValidatedOutboundContext, SensitiveCategory } from './types';
import {
  EMAIL_REGEX,
  PHONE_REGEX,
  AADHAAR_REGEX,
  PAN_REGEX,
  CREDIT_CARD_REGEX,
  AUTH_TOKEN_REGEX
} from './patterns';

const KNOWN_CATEGORIES: Set<SensitiveCategory> = new Set([
  'NAME',
  'EMAIL',
  'PHONE',
  'AADHAAR',
  'PAN',
  'PASSWORD',
  'DOB',
  'ADDRESS',
  'UNKNOWN_SENSITIVE'
]);

const FORBIDDEN_OBJECT_KEYS = [
  'password',
  'rawpassword',
  'raw_password',
  'passwd',
  'cookie',
  'cookies',
  'session',
  'sessiontoken',
  'session_token',
  'token',
  'authtoken',
  'auth_token',
  'authorization',
  'secret',
  'rawaadhaar',
  'rawpan'
];

/**
 * Recursively inspect all string values in an object to detect leaked sensitive data.
 * Does not expose raw values in error messages.
 */
function scanStringsForViolations(obj: unknown, path: string = ''): string[] {
  const violations: string[] = [];

  if (obj === null || obj === undefined) {
    return violations;
  }

  if (typeof obj === 'string') {
    // Check for raw Aadhaar
    if (AADHAAR_REGEX.test(obj)) {
      violations.push(`Unredacted Aadhaar pattern detected at ${path}`);
    }
    // Check for raw PAN
    if (PAN_REGEX.test(obj)) {
      violations.push(`Unredacted PAN pattern detected at ${path}`);
    }
    // Check for unmasked Email
    if (EMAIL_REGEX.test(obj)) {
      violations.push(`Unmasked email address detected at ${path}`);
    }
    // Check for unmasked Phone (10+ digits)
    if (PHONE_REGEX.test(obj) && obj.replace(/\D/g, '').length >= 10) {
      violations.push(`Unmasked telephone number detected at ${path}`);
    }
    // Check for Payment Cards
    if (CREDIT_CARD_REGEX.test(obj)) {
      violations.push(`Payment card pattern detected at ${path}`);
    }
    // Check for Auth tokens
    if (AUTH_TOKEN_REGEX.test(obj)) {
      violations.push(`Authentication token/secret detected at ${path}`);
    }
    return violations;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      violations.push(...scanStringsForViolations(item, `${path}[${index}]`));
    });
    return violations;
  }

  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_OBJECT_KEYS.includes(lowerKey)) {
        violations.push(`Forbidden sensitive key '${key}' present at ${path}`);
      }
      violations.push(...scanStringsForViolations(val, path ? `${path}.${key}` : key));
    }
  }

  return violations;
}

export function validateOutboundContext(payload: unknown): ValidatedOutboundContext {
  const errors: string[] = [];

  try {
    // 1. Structural integrity check (Malformed payload rejection)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        isValid: false,
        errors: ['Malformed payload: Payload must be a valid non-null object'],
        validatedAt: Date.now()
      };
    }

    const candidate = payload as Partial<SanitizedContext>;

    if (!candidate.page || typeof candidate.page !== 'object') {
      errors.push('Malformed payload: Missing or invalid page metadata');
    }

    if (!Array.isArray(candidate.elements)) {
      errors.push('Malformed payload: Missing elements array');
      return {
        isValid: false,
        errors,
        validatedAt: Date.now()
      };
    }

    // 2. Element validation
    for (let i = 0; i < candidate.elements.length; i++) {
      const el = candidate.elements[i];
      if (!el || typeof el !== 'object' || !el.id || !el.tagName || !el.decision) {
        errors.push(`Malformed element at index ${i}: Missing required id, tagName, or decision`);
        continue;
      }

      // Check category validity if present
      if (el.category && !KNOWN_CATEGORIES.has(el.category)) {
        errors.push(`Unknown sensitive category '${el.category}' at element id '${el.id}'`);
      }

      // Blocked elements must not have unblocked values
      if (el.decision === 'BLOCK') {
        if (el.value && el.value !== '[BLOCKED_SENSITIVE_DATA]') {
          errors.push(`Element '${el.id}' has BLOCK decision but contains non-blocked value`);
        }
      }

      // Password input fields must never have raw value or ALLOW decision
      if (el.type?.toLowerCase() === 'password') {
        if (el.decision !== 'BLOCK') {
          errors.push(`Password input field '${el.id}' does not have mandatory BLOCK decision`);
        }
        if (el.value && el.value !== '[BLOCKED_SENSITIVE_DATA]') {
          errors.push(`Password input field '${el.id}' contains unblocked raw value`);
        }
      }

      // Masked elements must only have redaction tokens or undefined
      if (el.decision === 'MASK' && el.value) {
        if (!el.value.startsWith('[REDACTED_') && el.value !== '[BLOCKED_SENSITIVE_DATA]') {
          errors.push(`Element '${el.id}' has MASK decision but value is not a redaction placeholder`);
        }
      }
    }

    // 3. Deep string inspection for leaked sensitive values
    const stringViolations = scanStringsForViolations(payload);
    errors.push(...stringViolations);

    const isValid = errors.length === 0;

    return {
      isValid,
      context: isValid ? (payload as SanitizedContext) : undefined,
      errors: isValid ? undefined : errors,
      validatedAt: Date.now(),
      diagnostics: {
        blockedViolationsCount: errors.filter(e => e.includes('BLOCK') || e.includes('Aadhaar') || e.includes('PAN') || e.includes('Password')).length,
        unmaskedSensitiveCount: errors.filter(e => e.includes('Unmasked') || e.includes('MASK')).length,
        reasons: errors
      }
    };
  } catch {
    // Fail closed on any unexpected exception
    return {
      isValid: false,
      errors: ['Validator failed closed due to an internal validation exception'],
      validatedAt: Date.now()
    };
  }
}
