/**
 * PRIVEDGE Phase 4: Privacy Firewall — Minimum Necessary Disclosure
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Constructs the MinimumDisclosure object — the ONLY thing that may leave the device.
 *
 * Allowed:
 *   page title, safe page metadata, safe DOM structure, safe interactive elements,
 *   safe accessibility roles/labels, element IDs, allowed coordinates,
 *   sanitized visual regions (bounding boxes + decision metadata), redaction counts.
 *
 * Never included:
 *   passwords, raw Aadhaar, raw PAN, raw email, raw phone, raw account numbers,
 *   raw DOB, raw addresses, auth tokens, cookies, session IDs, hidden DOM values,
 *   raw screenshot pixel data.
 *
 * INVARIANT: Only data required for future browser-agent reasoning is included.
 * Structural metadata of safe elements is preserved.
 */

import type { SanitizedContext } from '../privacy/types';
import type {
  FirewallDetection,
  FirewallSanitizedElement,
  FirewallVisualRegion,
  MinimumDisclosure
} from './types';
import { redactDomElements, buildVisualRegion } from './redactor';

/**
 * Builds the MinimumDisclosure object from sanitized context and firewall detections.
 *
 * @param sanitizedContext - Phase 1 sanitized DOM context
 * @param detections - Merged Phase 4 firewall detections
 * @param taskInstruction - Optional task instruction for the reasoning agent
 */
export function buildMinimumDisclosure(
  sanitizedContext: SanitizedContext,
  detections: FirewallDetection[],
  taskInstruction?: string
): MinimumDisclosure {
  // 1. Produce redacted DOM elements — only safe/masked structure survives
  const elements: FirewallSanitizedElement[] = redactDomElements(
    sanitizedContext.elements,
    detections
  );

  // 2. Produce visual region metadata from visual (Phase 3) detections
  const visualDetections = detections.filter(d => !d.elementId && d.boundingBox);
  const visualRegions: FirewallVisualRegion[] = visualDetections.map(buildVisualRegion);

  // 3. Count decisions
  const blockedCount = elements.filter(e => e.decision === 'BLOCK').length
    + detections.filter(d => d.decision === 'BLOCK' && !d.elementId).length;
  const maskedCount = elements.filter(e => e.decision === 'MASK').length
    + detections.filter(d => d.decision === 'MASK' && !d.elementId).length;
  const allowedCount = elements.filter(e => e.decision === 'ALLOW').length;
  const visualRedactedCount = visualRegions.filter(
    r => r.decision === 'MASK' || r.decision === 'BLOCK'
  ).length;

  // 4. Minimum page metadata — title is safe structural information
  //    URL is included; it is not raw PII (the URL itself is safe metadata)
  const page: MinimumDisclosure['page'] = {
    title: sanitizedContext.page.title,
    url: sanitizedContext.page.url,
    domain: sanitizedContext.page.domain
  };

  return {
    page,
    elements,
    visualRegions,
    taskInstruction: taskInstruction ?? sanitizedContext.taskInstruction,
    disclosedAt: Date.now(),
    firewallSummary: {
      totalDetections: detections.length,
      blockedCount,
      maskedCount,
      allowedCount,
      visualRedactedCount
    }
  };
}
