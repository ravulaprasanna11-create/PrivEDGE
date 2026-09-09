/**
 * PRIVEDGE Phase 4: Privacy Firewall — Public API
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Public interface for Phase 4. Future Phase 5/6 consumers must use
 * FirewallResult.disclosure (MinimumDisclosure) — never the raw FirewallInput.
 */

export { runPrivacyFirewall, runPrivacyFirewallFromRaw } from './pipeline';
export { applyFirewallPolicy, mergeDecisions, resolveDecisions } from './policy';
export { validateFirewallOutput } from './validator';
export { buildMinimumDisclosure } from './disclosure';
export { sanitizeDisclosure } from './sanitizer';
export {
  classifyPhase1Detections,
  classifyPhase2Elements,
  classifyPhase3Detections,
  mergeDetections
} from './classifier';
export {
  redactDomElements,
  redactElement,
  buildVisualRegion,
  applyOpaqueRedaction,
  redactScreenshot,
  FIREWALL_PLACEHOLDERS,
  BLOCKED_VALUE
} from './redactor';

export type {
  FirewallCategory,
  FirewallDecision,
  FirewallSource,
  FirewallDetection,
  FirewallSanitizedElement,
  FirewallVisualRegion,
  MinimumDisclosure,
  FirewallResult,
  FirewallInput,
  FirewallValidationResult,
  VisualBoundingBox
} from './types';
