/**
 * PRIVEDGE Phase 4: Privacy Firewall — Main Pipeline
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Orchestrates the complete Phase 4 privacy firewall flow:
 *
 *   Phase 1 PII detections
 *     + Phase 2 DOM/accessibility context (via sanitizedContext.elements)
 *     + Phase 3 visual detections
 *         ↓
 *   NORMALIZE + CLASSIFY
 *         ↓
 *   APPLY POLICY
 *         ↓
 *   REDACT / SANITIZE DOM + VISUAL
 *         ↓
 *   MINIMUM DISCLOSURE
 *         ↓
 *   INDEPENDENT VALIDATION
 *         ↓
 *   FirewallResult
 *
 * INVARIANTS:
 * - ZERO network/cloud/fetch calls.
 * - No raw PII in logs or errors.
 * - No raw screenshot returned.
 * - Fail closed: validation failure → BLOCKED result, no disclosure.
 * - Phase 5/6 must consume FirewallResult.disclosure, not raw input.
 */

import type { DetectionResult } from '../privacy/types';
import type { VisualDetection } from '../perception/types';
import type {
  FirewallInput,
  FirewallResult,
  FirewallDetection
} from './types';
import {
  classifyPhase1Detections,
  classifyPhase2Elements,
  classifyPhase3Detections,
  mergeDetections
} from './classifier';
import { buildMinimumDisclosure } from './disclosure';
import { sanitizeDisclosure } from './sanitizer';
import { validateFirewallOutput } from './validator';

/**
 * Runs the full Phase 4 Privacy Firewall pipeline.
 *
 * @param input - FirewallInput containing Phase 1 sanitized context and Phase 3 visual detections.
 * @param phase1Detections - Raw Phase 1 DetectionResult[] (used for fine-grained classification).
 * @returns FirewallResult — safe sanitized disclosure or a BLOCKED/VALIDATION_FAILED result.
 */
export function runPrivacyFirewall(
  input: FirewallInput,
  phase1Detections: DetectionResult[] = []
): FirewallResult {
  const timestamp = Date.now();

  try {
    const { sanitizedContext, visualDetections, taskInstruction } = input;

    // ---- Step 1: Classify all three phases ----

    const p1 = classifyPhase1Detections(phase1Detections);
    const p2 = classifyPhase2Elements(sanitizedContext.elements);
    const p3 = classifyPhase3Detections(visualDetections);

    // ---- Step 2: Merge detections (most-restrictive wins) ----

    const detections: FirewallDetection[] = mergeDetections(p1, p2, p3);

    const blockedCount = detections.filter(d => d.decision === 'BLOCK').length;
    const maskedCount = detections.filter(d => d.decision === 'MASK').length;
    const allowedCount = detections.filter(d => d.decision === 'ALLOW').length;
    const visualRedactedCount = detections.filter(
      d => !d.elementId && (d.decision === 'MASK' || d.decision === 'BLOCK')
    ).length;

    // ---- Step 3: Build minimum disclosure ----

    const rawDisclosure = buildMinimumDisclosure(sanitizedContext, detections, taskInstruction);

    // ---- Step 4: Final sanitization pass (defence-in-depth) ----

    const sanitizedDisclosure = sanitizeDisclosure(rawDisclosure);

    // ---- Step 5: Independent validation ----

    const validation = validateFirewallOutput(sanitizedDisclosure);

    if (!validation.isValid) {
      return {
        success: false,
        detections,
        error: 'Privacy firewall validation failed — payload blocked',
        diagnostics: {
          status: 'VALIDATION_FAILED',
          totalDetections: detections.length,
          blockedCount,
          maskedCount,
          allowedCount,
          visualRedactedCount,
          timestamp: Date.now()
        }
      };
    }

    return {
      success: true,
      disclosure: sanitizedDisclosure,
      detections,
      diagnostics: {
        status: 'PASS',
        totalDetections: detections.length,
        blockedCount,
        maskedCount,
        allowedCount,
        visualRedactedCount,
        timestamp: Date.now()
      }
    };
  } catch {
    // Fail closed — never expose partial or raw data
    return {
      success: false,
      detections: [],
      error: 'Privacy firewall pipeline failed closed due to an internal exception',
      diagnostics: {
        status: 'BLOCKED',
        totalDetections: 0,
        blockedCount: 0,
        maskedCount: 0,
        allowedCount: 0,
        visualRedactedCount: 0,
        timestamp: Date.now()
      }
    };
  }
}

/**
 * Convenience overload that accepts raw Phase 3 VisualDetection[] directly.
 * Useful when integrating with the extension service worker.
 */
export function runPrivacyFirewallFromRaw(
  input: FirewallInput,
  phase1Detections: DetectionResult[],
  _rawScreenDataUrl?: string  // accepted but NOT forwarded — never used as output
): FirewallResult {
  // Raw screenshot is deliberately not passed to the pipeline output.
  // The extension must call redactScreenshot() separately if a visual output is needed.
  return runPrivacyFirewall(input, phase1Detections);
}
