/**
 * PRIVEDGE Phase 1: Local Privacy Core - Sanitizer / Redactor
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Replaces sensitive values with typed redaction tokens or blocked indicators.
 * Preserves safe structural metadata necessary for browser agent navigation.
 */

import type { BrowserContext, BrowserElement, DetectionResult, SanitizedContext, SanitizedElement, SensitiveCategory } from './types';
import { evaluateElementPolicy } from './policy';
import {
  GLOBAL_EMAIL_REGEX,
  GLOBAL_PHONE_REGEX,
  GLOBAL_AADHAAR_REGEX,
  GLOBAL_PAN_REGEX,
  GLOBAL_DOB_DATE_REGEX,
  CREDIT_CARD_REGEX,
  AUTH_TOKEN_REGEX
} from './patterns';

const MASK_PLACEHOLDERS: Record<SensitiveCategory, string> = {
  EMAIL: '[REDACTED_EMAIL]',
  PHONE: '[REDACTED_PHONE]',
  NAME: '[REDACTED_NAME]',
  DOB: '[REDACTED_DOB]',
  ADDRESS: '[REDACTED_ADDRESS]',
  PASSWORD: '[BLOCKED_SENSITIVE_DATA]',
  AADHAAR: '[BLOCKED_SENSITIVE_DATA]',
  PAN: '[BLOCKED_SENSITIVE_DATA]',
  UNKNOWN_SENSITIVE: '[BLOCKED_SENSITIVE_DATA]'
};

export const BLOCKED_PLACEHOLDER = '[BLOCKED_SENSITIVE_DATA]';

/**
 * Redacts any inline sensitive patterns that may appear in generic text fields.
 */
export function sanitizeInlineText(text?: string): string | undefined {
  if (!text) return text;
  let sanitized = text;

  // Blocked categories first
  sanitized = sanitized.replace(GLOBAL_AADHAAR_REGEX, BLOCKED_PLACEHOLDER);
  sanitized = sanitized.replace(GLOBAL_PAN_REGEX, BLOCKED_PLACEHOLDER);

  // Masked categories
  sanitized = sanitized.replace(GLOBAL_EMAIL_REGEX, MASK_PLACEHOLDERS.EMAIL);
  sanitized = sanitized.replace(GLOBAL_PHONE_REGEX, MASK_PLACEHOLDERS.PHONE);

  return sanitized;
}

export function sanitizeElement(
  element: BrowserElement,
  detections: DetectionResult[]
): SanitizedElement {
  const policy = evaluateElementPolicy(element.id, detections);
  const isPopulated = Boolean(element.value && element.value.trim().length > 0);

  let sanitizedValue: string | undefined;

  switch (policy.decision) {
    case 'BLOCK':
      // Raw sensitive value MUST NOT appear in output
      sanitizedValue = BLOCKED_PLACEHOLDER;
      break;

    case 'MASK': {
      const placeholder = policy.category ? MASK_PLACEHOLDERS[policy.category] : '[REDACTED_PII]';
      sanitizedValue = isPopulated ? placeholder : undefined;
      break;
    }

    case 'ALLOW':
    default:
      // Even for allowed elements, protect against inadvertent PII in value/text
      sanitizedValue = sanitizeInlineText(element.value);
      break;
  }

  return {
    id: element.id,
    tagName: element.tagName,
    type: element.type,
    name: element.name,
    selector: element.selector,
    role: element.role,
    ariaLabel: sanitizeInlineText(element.ariaLabel),
    label: sanitizeInlineText(element.label),
    placeholder: sanitizeInlineText(element.placeholder),
    decision: policy.decision,
    category: policy.category,
    value: sanitizedValue,
    text: sanitizeInlineText(element.text),
    surroundingText: sanitizeInlineText(element.surroundingText),
    isPopulated,
    isInteractive: element.isInteractive,
    isVisible: element.isVisible
  };
}

export function sanitizeContext(
  context: BrowserContext,
  detections: DetectionResult[]
): SanitizedContext {
  let redactionCount = 0;
  let blockedCount = 0;

  const sanitizedElements = (context.elements || []).map(element => {
    const sanitized = sanitizeElement(element, detections);
    if (sanitized.decision === 'BLOCK') {
      blockedCount++;
    } else if (sanitized.decision === 'MASK') {
      redactionCount++;
    }
    return sanitized;
  });

  return {
    page: {
      url: context.page?.url || '',
      title: sanitizeInlineText(context.page?.title) || '',
      domain: context.page?.domain
    },
    elements: sanitizedElements,
    taskInstruction: context.taskInstruction,
    sanitizedAt: Date.now(),
    redactionCount,
    blockedCount
  };
}
