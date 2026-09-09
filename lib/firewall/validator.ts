/**
 * PRIVEDGE Phase 4: Privacy Firewall — Independent Outbound Validator
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Validates the MinimumDisclosure object INDEPENDENTLY from the sanitization path.
 * Purpose: "Even if the sanitizer makes a mistake, the validator prevents unsafe
 * context from leaving the device."
 *
 * Reuses Phase 1 regex patterns — no duplication.
 *
 * INVARIANTS:
 * - Fail closed: any unsafe/unknown content → FAIL.
 * - Unable to determine safety → FAIL.
 * - NEVER returns the raw input as a fallback.
 * - Recursively inspects strings, arrays, and nested objects.
 * - No raw PII in error messages.
 */

import type { MinimumDisclosure, FirewallValidationResult } from './types';
import {
  EMAIL_REGEX,
  PHONE_REGEX,
  AADHAAR_REGEX,
  PAN_REGEX,
  CREDIT_CARD_REGEX,
  AUTH_TOKEN_REGEX
} from '../privacy/patterns';
import { BLOCKED_VALUE } from './redactor';

/** Forbidden keys that must never appear in an outbound payload. */
const FORBIDDEN_KEYS = new Set([
  'password', 'rawpassword', 'raw_password', 'passwd',
  'cookie', 'cookies', 'session', 'sessiontoken', 'session_token',
  'token', 'authtoken', 'auth_token', 'authorization',
  'secret', 'rawaadhaar', 'rawpan', 'rawscreenshot',
  'screenshotdataurl', 'screenshot_data_url'
]);

/**
 * Recursively inspects all string values in an object for leaked PII.
 * Does NOT include raw values in violation messages.
 */
function scanForViolations(obj: unknown, path = ''): string[] {
  const violations: string[] = [];
  if (obj === null || obj === undefined) return violations;

  if (typeof obj === 'string') {
    // Skip known safe redaction/block placeholders
    if (obj.startsWith('[REDACTED') || obj === BLOCKED_VALUE) return violations;

    if (AADHAAR_REGEX.test(obj)) {
      violations.push(`Unredacted Aadhaar pattern at ${path}`);
    }
    if (PAN_REGEX.test(obj)) {
      violations.push(`Unredacted PAN pattern at ${path}`);
    }
    if (EMAIL_REGEX.test(obj)) {
      violations.push(`Unmasked email address at ${path}`);
    }
    if (PHONE_REGEX.test(obj) && obj.replace(/\D/g, '').length >= 10) {
      violations.push(`Unmasked phone number at ${path}`);
    }
    if (CREDIT_CARD_REGEX.test(obj)) {
      violations.push(`Payment card pattern at ${path}`);
    }
    if (AUTH_TOKEN_REGEX.test(obj)) {
      violations.push(`Auth token/secret at ${path}`);
    }
    return violations;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => violations.push(...scanForViolations(item, `${path}[${i}]`)));
    return violations;
  }

  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase().replace(/[_\-]/g, '');
      if (FORBIDDEN_KEYS.has(lowerKey)) {
        violations.push(`Forbidden key '${key}' present at ${path}`);
      }
      violations.push(...scanForViolations(val, path ? `${path}.${key}` : key));
    }
  }

  return violations;
}

/**
 * Validates a MinimumDisclosure object before it may be used as an outbound candidate.
 *
 * Validation checks:
 * 1. Structural integrity (required fields present).
 * 2. No blocked elements with raw values.
 * 3. No masked elements with non-placeholder values.
 * 4. Recursive string scan for leaked PII patterns.
 * 5. No forbidden key names (cookies, sessions, raw passwords, raw screenshots).
 */
export function validateFirewallOutput(disclosure: unknown): FirewallValidationResult {
  try {
    // 1. Structural check
    if (!disclosure || typeof disclosure !== 'object' || Array.isArray(disclosure)) {
      return {
        isValid: false,
        errors: ['Malformed disclosure: must be a non-null object'],
        validatedAt: Date.now()
      };
    }

    const d = disclosure as Partial<MinimumDisclosure>;
    const errors: string[] = [];

    if (!d.page || typeof d.page !== 'object') {
      errors.push('Missing or invalid page metadata');
    }
    if (!Array.isArray(d.elements)) {
      errors.push('Missing elements array');
      return { isValid: false, errors, validatedAt: Date.now() };
    }
    if (!Array.isArray(d.visualRegions)) {
      errors.push('Missing visualRegions array');
    }

    // 2. Per-element checks
    for (let i = 0; i < (d.elements?.length ?? 0); i++) {
      const el = d.elements![i];
      if (!el || !el.id || !el.tagName || !el.decision) {
        errors.push(`Element[${i}] missing required fields (id, tagName, decision)`);
        continue;
      }

      // BLOCK elements must not carry raw values
      if (el.decision === 'BLOCK') {
        if (el.value && el.value !== BLOCKED_VALUE) {
          errors.push(`Element '${el.id}' is BLOCK but value is not blocked placeholder`);
        }
        if (el.text) {
          errors.push(`Element '${el.id}' is BLOCK but text field is non-empty`);
        }
      }

      // MASK elements must only have redaction tokens
      if (el.decision === 'MASK' && el.value) {
        if (!el.value.startsWith('[REDACTED') && el.value !== BLOCKED_VALUE) {
          errors.push(`Element '${el.id}' is MASK but value is not a redaction token`);
        }
      }

      // Password DOM inputs must always be BLOCK
      if (el.type?.toLowerCase() === 'password' && el.decision !== 'BLOCK') {
        errors.push(`Password input '${el.id}' does not have BLOCK decision`);
      }
    }

    // 3. Visual region checks — sensitive regions must have '[REDACTED]' label
    for (let i = 0; i < (d.visualRegions?.length ?? 0); i++) {
      const vr = d.visualRegions![i];
      if (vr.decision !== 'ALLOW' && vr.label !== '[REDACTED]') {
        errors.push(`Visual region '${vr.id}' is sensitive but label is not '[REDACTED]'`);
      }
    }

    // 4. Recursive deep scan
    const deepViolations = scanForViolations(disclosure, 'disclosure');
    errors.push(...deepViolations);

    // 5. Check for screenshot data URL in any field
    const serialized = JSON.stringify(disclosure);
    if (serialized.includes('data:image/')) {
      errors.push('Raw image data URL detected in disclosure — raw screenshot must not be included');
    }

    const isValid = errors.length === 0;
    return {
      isValid,
      errors: isValid ? undefined : errors,
      validatedAt: Date.now()
    };
  } catch {
    // Fail closed on any unexpected validator exception
    return {
      isValid: false,
      errors: ['Validator failed closed due to internal exception'],
      validatedAt: Date.now()
    };
  }
}
