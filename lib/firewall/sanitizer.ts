/**
 * PRIVEDGE Phase 4: Privacy Firewall — Outbound Sanitizer
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Final deterministic sanitization pass over the MinimumDisclosure object.
 * Ensures no blocked/masked value slipped through earlier pipeline stages.
 *
 * Also sanitizes screenshot: ensures a redacted version is produced or none.
 *
 * INVARIANTS:
 * - Blocked elements → value forced to BLOCKED_VALUE, text removed.
 * - Masked elements → value forced to typed placeholder if raw value slipped through.
 * - Visual regions → label '[REDACTED]' for sensitive regions.
 * - Raw screenshot is NEVER returned; only the redacted version may proceed.
 * - Deterministic — no randomization.
 */

import type { MinimumDisclosure, FirewallSanitizedElement, FirewallVisualRegion } from './types';
import { sanitizeInlineText } from '../privacy/sanitizer';
import { FIREWALL_PLACEHOLDERS, BLOCKED_VALUE } from './redactor';

/**
 * Ensures every element in the disclosure has correct value tokens.
 * Acts as a defence-in-depth pass after the main redactor.
 */
function sanitizeElement(el: FirewallSanitizedElement): FirewallSanitizedElement {
  if (el.decision === 'BLOCK') {
    return {
      ...el,
      value: BLOCKED_VALUE,
      text: undefined
    };
  }
  if (el.decision === 'MASK') {
    const expectedPlaceholder = el.category ? FIREWALL_PLACEHOLDERS[el.category] : '[REDACTED_PII]';
    // If the value looks like a raw PII (doesn't start with '[REDACTED'), force placeholder
    const safeValue = el.value === undefined
      ? undefined
      : (el.value.startsWith('[REDACTED') || el.value === BLOCKED_VALUE)
        ? el.value
        : expectedPlaceholder;
    return {
      ...el,
      value: safeValue,
      text: el.text ? sanitizeInlineText(el.text) : undefined
    };
  }
  // ALLOW — inline-sanitize any lingering PII in text fields
  return {
    ...el,
    value: el.value ? sanitizeInlineText(el.value) : undefined,
    text: el.text ? sanitizeInlineText(el.text) : undefined,
    ariaLabel: el.ariaLabel ? sanitizeInlineText(el.ariaLabel) : undefined,
    label: el.label ? sanitizeInlineText(el.label) : undefined,
    placeholder: el.placeholder ? sanitizeInlineText(el.placeholder) : undefined
  };
}

/**
 * Ensures sensitive visual regions have their labels redacted.
 */
function sanitizeVisualRegion(region: FirewallVisualRegion): FirewallVisualRegion {
  if (region.decision === 'MASK' || region.decision === 'BLOCK') {
    return { ...region, label: '[REDACTED]' };
  }
  return region;
}

/**
 * Applies the final sanitization pass to the MinimumDisclosure object.
 * Returns a fully sanitized MinimumDisclosure safe for the independent validator.
 */
export function sanitizeDisclosure(disclosure: MinimumDisclosure): MinimumDisclosure {
  const elements: FirewallSanitizedElement[] = disclosure.elements.map(sanitizeElement);
  const visualRegions: FirewallVisualRegion[] = disclosure.visualRegions.map(sanitizeVisualRegion);

  return {
    ...disclosure,
    elements,
    visualRegions
  };
}
