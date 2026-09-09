/**
 * PRIVEDGE Phase 4: Privacy Firewall — Centralized Policy Engine
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Single authoritative source for all ALLOW / MASK / BLOCK decisions.
 * Conflict rule: BLOCK > MASK > ALLOW — a decision can only be escalated, never downgraded.
 *
 * SECURITY INVARIANTS:
 * - Unknown/unmapped categories → BLOCK (fail closed).
 * - BLOCK can never be overridden.
 * - No policy logic should live outside this file.
 */

import type { FirewallCategory, FirewallDecision } from './types';

/**
 * Maps a single FirewallCategory to its canonical FirewallDecision.
 * Fail-closed: any category not explicitly listed → BLOCK.
 */
export function applyFirewallPolicy(category: FirewallCategory): FirewallDecision {
  switch (category) {
    // Hard block — most sensitive, must never leave the device
    case 'PASSWORD':
    case 'AADHAAR':
    case 'PAN':
    case 'UNKNOWN_SENSITIVE':
      return 'BLOCK';

    // Mask — PII that may be disclosed in anonymised form
    case 'EMAIL':
    case 'PHONE':
    case 'ACCOUNT_NUMBER':
    case 'DOB':
    case 'ADDRESS':
    case 'NAME':
    case 'FACE':       // Visual person-region → local spatial redaction
      return 'MASK';

    // Safe — no sensitive content detected
    case 'SAFE':
      return 'ALLOW';

    default:
      // Fail closed: unknown future categories must not become ALLOW
      return 'BLOCK';
  }
}

/**
 * Merges two FirewallDecisions, always preserving the more restrictive one.
 * BLOCK > MASK > ALLOW.
 */
export function mergeDecisions(a: FirewallDecision, b: FirewallDecision): FirewallDecision {
  if (a === 'BLOCK' || b === 'BLOCK') return 'BLOCK';
  if (a === 'MASK' || b === 'MASK') return 'MASK';
  return 'ALLOW';
}

/**
 * Given a list of decisions (e.g. from overlapping detections), returns the
 * single most-restrictive result.  Never downgrades.
 */
export function resolveDecisions(decisions: FirewallDecision[]): FirewallDecision {
  return decisions.reduce<FirewallDecision>(
    (acc, d) => mergeDecisions(acc, d),
    'ALLOW'
  );
}
