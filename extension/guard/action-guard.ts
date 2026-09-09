/**
 * PRIVEDGE Phase 7: Local Action Guard
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Deterministic local security boundary for action proposals.
 * Evaluates action proposals against current DOM state and strict security policies.
 *
 * INVARIANTS:
 * - Cloud/model proposals are NEVER trusted directly.
 * - FAIL CLOSED: Any uncertainty, invalidity, or policy violation leads to BLOCK.
 * - No arbitrary JavaScript execution.
 * - No sensitive PII insertion.
 */

import { isElementVisible } from '../content/dom';
export { isElementVisible };

export type GuardActionType = 'click' | 'scroll' | 'type' | 'navigate';

export interface GuardActionTarget {
  elementId?: string;
  coordinates?: { x: number; y: number };
  scrollDelta?: { x: number; y: number };
  url?: string;
  text?: string;
}

export interface GuardActionProposal {
  actionType: string;
  target?: GuardActionTarget;
  action?: string;
  targetElementId?: string;
  scrollDelta?: { x: number; y: number };
  url?: string;
  text?: string;
  reason?: string;
  confidence?: number;
}

export interface GuardCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface ActionGuardDecision {
  approved: boolean;
  action: {
    actionType: GuardActionType;
    targetElementId?: string;
    scrollDelta?: { x: number; y: number };
    url?: string;
    text?: string;
  };
  reason: string;
  guardChecks: GuardCheck[];
}

const SUPPORTED_ACTIONS: readonly GuardActionType[] = ['click', 'scroll', 'type', 'navigate'];
const MAX_SCROLL_DELTA = 2000;

// Sensitive patterns that must NEVER be typed via model action
const SENSITIVE_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /bearer\s+[a-zA-Z0-9_\-\.]+/i,
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/, // Aadhaar pattern
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,     // PAN pattern
  /\b\d{9,18}\b/,                  // Bank account pattern
  /cookie/i,
];

/**
 * Normalizes input proposal into standard structure.
 */
function normalizeProposal(proposal: unknown): {
  actionType: string;
  targetElementId?: string;
  scrollDelta?: { x: number; y: number };
  url?: string;
  text?: string;
} | null {
  if (!proposal || typeof proposal !== 'object') return null;
  const p = proposal as Record<string, unknown>;

  const rawAction = (p['actionType'] ?? p['action']) as string | undefined;
  if (typeof rawAction !== 'string') return null;

  const target = (p['target'] && typeof p['target'] === 'object' ? p['target'] : p) as Record<string, unknown>;

  const targetElementId = (target['elementId'] ?? target['targetElementId'] ?? p['targetElementId']) as string | undefined;
  const scrollDelta = (target['scrollDelta'] ?? p['scrollDelta']) as { x: number; y: number } | undefined;
  const url = (target['url'] ?? p['url']) as string | undefined;
  const text = (target['text'] ?? p['text'] ?? target['value']) as string | undefined;

  return {
    actionType: rawAction.toLowerCase().trim(),
    targetElementId: typeof targetElementId === 'string' ? targetElementId.trim() : undefined,
    scrollDelta: scrollDelta && typeof scrollDelta === 'object' ? scrollDelta : undefined,
    url: typeof url === 'string' ? url.trim() : undefined,
    text: typeof text === 'string' ? text : undefined,
  };
}

function isHtmlElement(el: unknown): el is HTMLElement {
  if (!el || typeof el !== 'object') return false;
  if (typeof HTMLElement !== 'undefined') {
    return el instanceof HTMLElement;
  }
  return true;
}

function escapeCssSelector(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/["\\]/g, '\\$&');
}

/**
 * Checks if target element is interactable (not disabled or aria-disabled).
 */
export function isElementInteractable(el: HTMLElement): boolean {
  if (!el) return false;
  if ((el as any).disabled === true) {
    return false;
  }
  if (typeof el.getAttribute === 'function' && el.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  return true;
}

/**
 * Locates an element in the document by data-prv-id, id, or selector.
 */
export function findTargetElement(doc: Document, elementId: string): HTMLElement | null {
  if (!doc || !elementId) return null;

  // 1. Check data-prv-id
  try {
    const byDataId = doc.querySelector(`[data-prv-id="${escapeCssSelector(elementId)}"]`);
    if (isHtmlElement(byDataId)) return byDataId;
  } catch {
    // Fallback if escape fails
  }

  // 2. Direct ID
  if (typeof doc.getElementById === 'function') {
    const byId = doc.getElementById(elementId);
    if (isHtmlElement(byId)) return byId;
  }

  // 3. Simple querySelector if valid selector
  try {
    const byQuery = doc.querySelector(elementId);
    if (isHtmlElement(byQuery)) return byQuery;
  } catch {
    // Not a valid selector, safe to ignore
  }

  return null;
}

/**
 * Validates a URL for safe navigation.
 */
export function isSafeNavigationUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Local Action Guard: Evaluates an action proposal against safety policies and current DOM.
 * FAIL-CLOSED.
 */
export function evaluateActionGuard(
  proposal: unknown,
  doc?: Document,
  win?: Window
): ActionGuardDecision {
  const guardChecks: GuardCheck[] = [];

  // Check 1: Structure & Schema
  const normalized = normalizeProposal(proposal);
  if (!normalized) {
    guardChecks.push({ name: 'schema_validation', passed: false, reason: 'Malformed action proposal structure.' });
    return {
      approved: false,
      action: { actionType: 'click' },
      reason: 'Action Guard BLOCKED: Malformed action proposal.',
      guardChecks,
    };
  }
  guardChecks.push({ name: 'schema_validation', passed: true });

  const { actionType, targetElementId, scrollDelta, url, text } = normalized;

  // Check 2: Action Type Supported
  if (!SUPPORTED_ACTIONS.includes(actionType as GuardActionType)) {
    guardChecks.push({
      name: 'supported_action',
      passed: false,
      reason: `Action "${actionType}" is not supported. Supported: ${SUPPORTED_ACTIONS.join(', ')}.`,
    });
    return {
      approved: false,
      action: { actionType: 'click' },
      reason: `Action Guard BLOCKED: Unsupported action "${actionType}".`,
      guardChecks,
    };
  }
  guardChecks.push({ name: 'supported_action', passed: true });

  // Check 3: Action-Specific Safety & Policy Checks
  if (actionType === 'click') {
    // Target element ID is required
    if (!targetElementId) {
      guardChecks.push({ name: 'target_id_present', passed: false, reason: 'targetElementId is required for click.' });
      return {
        approved: false,
        action: { actionType: 'click' },
        reason: 'Action Guard BLOCKED: Missing target element ID.',
        guardChecks,
      };
    }
    guardChecks.push({ name: 'target_id_present', passed: true });

    if (doc) {
      // Find element in current DOM
      const element = findTargetElement(doc, targetElementId);
      if (!element) {
        guardChecks.push({ name: 'target_exists', passed: false, reason: `Target "${targetElementId}" not found in current page.` });
        return {
          approved: false,
          action: { actionType: 'click', targetElementId },
          reason: `Action Guard BLOCKED: Target element "${targetElementId}" does not exist (stale or unknown).`,
          guardChecks,
        };
      }
      guardChecks.push({ name: 'target_exists', passed: true });

      // Visibility check
      if (!isElementVisible(element, win)) {
        guardChecks.push({ name: 'target_visible', passed: false, reason: `Target "${targetElementId}" is hidden or not visible.` });
        return {
          approved: false,
          action: { actionType: 'click', targetElementId },
          reason: `Action Guard BLOCKED: Target element "${targetElementId}" is hidden or not visible.`,
          guardChecks,
        };
      }
      guardChecks.push({ name: 'target_visible', passed: true });

      // Interactability check
      if (!isElementInteractable(element)) {
        guardChecks.push({ name: 'target_interactable', passed: false, reason: `Target "${targetElementId}" is disabled.` });
        return {
          approved: false,
          action: { actionType: 'click', targetElementId },
          reason: `Action Guard BLOCKED: Target element "${targetElementId}" is disabled.`,
          guardChecks,
        };
      }
      guardChecks.push({ name: 'target_interactable', passed: true });
    }

    return {
      approved: true,
      action: { actionType: 'click', targetElementId },
      reason: `Action Guard APPROVED: Click on validated target "${targetElementId}".`,
      guardChecks,
    };
  }

  if (actionType === 'scroll') {
    if (!scrollDelta || typeof scrollDelta.x !== 'number' || typeof scrollDelta.y !== 'number') {
      guardChecks.push({ name: 'scroll_delta_valid', passed: false, reason: 'scrollDelta must contain numeric x and y.' });
      return {
        approved: false,
        action: { actionType: 'scroll' },
        reason: 'Action Guard BLOCKED: Invalid scroll delta values.',
        guardChecks,
      };
    }

    if (isNaN(scrollDelta.x) || isNaN(scrollDelta.y) || !isFinite(scrollDelta.x) || !isFinite(scrollDelta.y)) {
      guardChecks.push({ name: 'scroll_delta_finite', passed: false, reason: 'scrollDelta values must be finite numbers.' });
      return {
        approved: false,
        action: { actionType: 'scroll' },
        reason: 'Action Guard BLOCKED: Scroll delta must be finite numbers.',
        guardChecks,
      };
    }

    if (Math.abs(scrollDelta.x) > MAX_SCROLL_DELTA || Math.abs(scrollDelta.y) > MAX_SCROLL_DELTA) {
      guardChecks.push({
        name: 'scroll_delta_bounded',
        passed: false,
        reason: `Scroll delta exceeds maximum allowed delta of ${MAX_SCROLL_DELTA}px.`,
      });
      return {
        approved: false,
        action: { actionType: 'scroll', scrollDelta },
        reason: `Action Guard BLOCKED: Excessive scroll delta (${scrollDelta.x}, ${scrollDelta.y}).`,
        guardChecks,
      };
    }
    guardChecks.push({ name: 'scroll_delta_bounded', passed: true });

    return {
      approved: true,
      action: { actionType: 'scroll', scrollDelta },
      reason: `Action Guard APPROVED: Bounded scroll delta (${scrollDelta.x}, ${scrollDelta.y}).`,
      guardChecks,
    };
  }

  if (actionType === 'type') {
    if (!targetElementId) {
      guardChecks.push({ name: 'target_id_present', passed: false, reason: 'targetElementId is required for type.' });
      return {
        approved: false,
        action: { actionType: 'type' },
        reason: 'Action Guard BLOCKED: Missing target element ID for typing.',
        guardChecks,
      };
    }
    guardChecks.push({ name: 'target_id_present', passed: true });

    if (typeof text !== 'string') {
      guardChecks.push({ name: 'type_text_valid', passed: false, reason: 'Text to type must be a valid string.' });
      return {
        approved: false,
        action: { actionType: 'type', targetElementId },
        reason: 'Action Guard BLOCKED: Missing or invalid text payload for type action.',
        guardChecks,
      };
    }

    // Check for sensitive PII patterns in typing text
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(text)) {
        guardChecks.push({ name: 'type_no_sensitive_pii', passed: false, reason: 'Sensitive PII or credential pattern detected in typing text.' });
        return {
          approved: false,
          action: { actionType: 'type', targetElementId },
          reason: 'Action Guard BLOCKED: Sensitive data pattern detected in typing payload.',
          guardChecks,
        };
      }
    }
    guardChecks.push({ name: 'type_no_sensitive_pii', passed: true });

    if (doc) {
      const element = findTargetElement(doc, targetElementId);
      if (!element) {
        guardChecks.push({ name: 'target_exists', passed: false, reason: `Target "${targetElementId}" not found in current page.` });
        return {
          approved: false,
          action: { actionType: 'type', targetElementId },
          reason: `Action Guard BLOCKED: Target element "${targetElementId}" does not exist.`,
          guardChecks,
        };
      }
      guardChecks.push({ name: 'target_exists', passed: true });

      // NEVER type into a password input field
      if (element.tagName.toLowerCase() === 'input' && (element as HTMLInputElement).type === 'password') {
        guardChecks.push({ name: 'target_not_password', passed: false, reason: 'Typing into password fields is strictly forbidden.' });
        return {
          approved: false,
          action: { actionType: 'type', targetElementId },
          reason: 'Action Guard BLOCKED: Target is a password field.',
          guardChecks,
        };
      }
      guardChecks.push({ name: 'target_not_password', passed: true });

      if (!isElementVisible(element, win)) {
        guardChecks.push({ name: 'target_visible', passed: false, reason: `Target "${targetElementId}" is hidden.` });
        return {
          approved: false,
          action: { actionType: 'type', targetElementId },
          reason: `Action Guard BLOCKED: Target element "${targetElementId}" is hidden.`,
          guardChecks,
        };
      }
      guardChecks.push({ name: 'target_visible', passed: true });

      if (!isElementInteractable(element)) {
        guardChecks.push({ name: 'target_interactable', passed: false, reason: `Target "${targetElementId}" is disabled.` });
        return {
          approved: false,
          action: { actionType: 'type', targetElementId },
          reason: `Action Guard BLOCKED: Target element "${targetElementId}" is disabled.`,
          guardChecks,
        };
      }
      guardChecks.push({ name: 'target_interactable', passed: true });
    }

    return {
      approved: true,
      action: { actionType: 'type', targetElementId, text },
      reason: `Action Guard APPROVED: Safe text insertion into target "${targetElementId}".`,
      guardChecks,
    };
  }

  if (actionType === 'navigate') {
    if (!url || typeof url !== 'string') {
      guardChecks.push({ name: 'url_present', passed: false, reason: 'URL is required for navigate.' });
      return {
        approved: false,
        action: { actionType: 'navigate' },
        reason: 'Action Guard BLOCKED: Missing navigation URL.',
        guardChecks,
      };
    }

    if (!isSafeNavigationUrl(url)) {
      guardChecks.push({ name: 'url_safe_scheme', passed: false, reason: 'URL scheme must be http: or https:.' });
      return {
        approved: false,
        action: { actionType: 'navigate', url },
        reason: 'Action Guard BLOCKED: Unsafe or malformed navigation URL scheme.',
        guardChecks,
      };
    }
    guardChecks.push({ name: 'url_safe_scheme', passed: true });

    return {
      approved: true,
      action: { actionType: 'navigate', url },
      reason: `Action Guard APPROVED: Safe navigation to "${url}".`,
      guardChecks,
    };
  }

  // Fallback: fail closed
  return {
    approved: false,
    action: { actionType: 'click' },
    reason: 'Action Guard BLOCKED: Unknown or uncertain action state.',
    guardChecks,
  };
}
