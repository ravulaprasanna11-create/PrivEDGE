/**
 * PRIVEDGE Phase 6 — Structured Reasoning Output Parser & Validator
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Strict validation of model output against schema and sanitized context.
 * FAIL-CLOSED: Rejects ungrounded element IDs, arbitrary code, or unsafe payloads.
 */

import type { StructuredActionProposal, ReasoningActionType } from '../types/reasoning';
import type { SafeElement } from '../types/api';
import { FORBIDDEN_KEYS } from '../types/api';

const SUPPORTED_ACTIONS: readonly ReasoningActionType[] = ['click', 'scroll', 'navigate', 'none'];

export const SAFE_FAILURE_PROPOSAL: StructuredActionProposal = {
  action: 'none',
  reason: 'No safe actionable target was identified.',
  confidence: 0,
};

export interface ParseValidationResult {
  valid: boolean;
  proposal: StructuredActionProposal;
  error?: string;
}

/**
 * Strips markdown code blocks if the LLM wrapped JSON in ```json ... ```
 */
export function extractJsonString(rawText: string): string {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('```')) {
    const lines = trimmed.split('\n');
    // Drop first line (e.g. ```json) and last line (```)
    return lines.slice(1, lines.length - (lines[lines.length - 1].trim().endsWith('```') ? 1 : 0)).join('\n').trim();
  }
  return trimmed;
}

function stripAuth(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return '';
    }
    ['token', 'access_token', 'auth', 'key', 'apikey', 'secret', 'session', 'password'].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return '';
  }
}

/**
 * Validates and parses raw text from reasoning provider.
 */
export function parseAndValidateProposal(
  rawText: string,
  availableElements: SafeElement[]
): ParseValidationResult {
  let parsed: unknown;
  try {
    const jsonStr = extractJsonString(rawText);
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      valid: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      error: 'Invalid JSON returned by reasoning model.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      error: 'Model output must be a JSON object.',
    };
  }

  const obj = parsed as Record<string, unknown>;

  // Check forbidden keys in model output as defense in depth
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase() as typeof FORBIDDEN_KEYS[number])) {
      return {
        valid: false,
        proposal: SAFE_FAILURE_PROPOSAL,
        error: `Forbidden field "${key}" detected in model output.`,
      };
    }
  }

  const action = obj['action'];
  if (typeof action !== 'string' || !SUPPORTED_ACTIONS.includes(action as ReasoningActionType)) {
    return {
      valid: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      error: `Unsupported action "${String(action)}". Must be one of: ${SUPPORTED_ACTIONS.join(', ')}.`,
    };
  }

  const reason = typeof obj['reason'] === 'string' && obj['reason'].trim() ? obj['reason'].trim() : 'No reason provided.';
  const rawConfidence = typeof obj['confidence'] === 'number' ? obj['confidence'] : 0.5;
  const confidence = Math.max(0, Math.min(1, rawConfidence));

  // Action: none
  if (action === 'none') {
    return {
      valid: true,
      proposal: {
        action: 'none',
        reason,
        confidence,
      },
    };
  }

  // Action: click
  if (action === 'click') {
    const targetElementId = obj['targetElementId'];
    if (typeof targetElementId !== 'string' || !targetElementId.trim()) {
      return {
        valid: false,
        proposal: SAFE_FAILURE_PROPOSAL,
        error: 'targetElementId is required for click action.',
      };
    }

    // Grounding check: targetElementId must exist in the provided sanitized elements
    const validElementIds = new Set(
      availableElements
        .map(e => e.id ?? e.stableId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );

    if (!validElementIds.has(targetElementId)) {
      return {
        valid: false,
        proposal: SAFE_FAILURE_PROPOSAL,
        error: `Target element ID "${targetElementId}" is not present in the sanitized context.`,
      };
    }

    return {
      valid: true,
      proposal: {
        action: 'click',
        targetElementId,
        reason,
        confidence,
      },
    };
  }

  // Action: scroll
  if (action === 'scroll') {
    let scrollDelta: { x: number; y: number } = { x: 0, y: 300 };
    if (obj['scrollDelta'] && typeof obj['scrollDelta'] === 'object') {
      const sd = obj['scrollDelta'] as Record<string, unknown>;
      scrollDelta = {
        x: typeof sd['x'] === 'number' ? sd['x'] : 0,
        y: typeof sd['y'] === 'number' ? sd['y'] : 300,
      };
    }
    return {
      valid: true,
      proposal: {
        action: 'scroll',
        scrollDelta,
        reason,
        confidence,
      },
    };
  }

  // Action: navigate
  if (action === 'navigate') {
    const url = obj['url'];
    if (typeof url !== 'string' || !url.trim()) {
      return {
        valid: false,
        proposal: SAFE_FAILURE_PROPOSAL,
        error: 'url is required for navigate action.',
      };
    }
    const cleanUrl = stripAuth(url);
    if (!cleanUrl) {
      return {
        valid: false,
        proposal: SAFE_FAILURE_PROPOSAL,
        error: 'Invalid or disallowed navigation URL.',
      };
    }

    return {
      valid: true,
      proposal: {
        action: 'navigate',
        url: cleanUrl,
        reason,
        confidence,
      },
    };
  }

  return {
    valid: false,
    proposal: SAFE_FAILURE_PROPOSAL,
    error: 'Unknown action type.',
  };
}
