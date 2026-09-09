/**
 * PRIVEDGE Phase 4: Privacy Firewall — Type Definitions
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Unified type system for the Phase 4 Privacy Firewall.
 * Combines Phase 1 (rule/DOM), Phase 2 (accessibility/DOM), and Phase 3 (visual) signals
 * into a single decision layer before any context leaves the device.
 *
 * INVARIANTS:
 * - Raw sensitive values MUST NOT appear in any FirewallDetection or output type.
 * - Source attribution MUST be accurate: DOM | RULE | VISUAL | COMBINED.
 * - Decision BLOCK cannot be downgraded to MASK or ALLOW.
 */

import type { VisualBoundingBox, VisualDetection } from '../perception/types';
import type { SanitizedContext } from '../privacy/types';

export type {
  VisualBoundingBox,
  VisualDetection
};

/**
 * Superset of Phase 1 SensitiveCategory adding FACE and ACCOUNT_NUMBER.
 * SAFE represents elements that passed all checks.
 */
export type FirewallCategory =
  | 'PASSWORD'
  | 'AADHAAR'
  | 'PAN'
  | 'EMAIL'
  | 'PHONE'
  | 'DOB'
  | 'ADDRESS'
  | 'NAME'
  | 'ACCOUNT_NUMBER'
  | 'FACE'
  | 'UNKNOWN_SENSITIVE'
  | 'SAFE';

/** The three possible privacy decisions — in conflict, BLOCK > MASK > ALLOW. */
export type FirewallDecision = 'ALLOW' | 'MASK' | 'BLOCK';

/** Where the detection originated. */
export type FirewallSource = 'DOM' | 'RULE' | 'VISUAL' | 'COMBINED';

/**
 * A single firewall detection record.
 * NEVER contains a raw sensitive value.
 */
export interface FirewallDetection {
  /** Unique identifier correlating to a DOM element or visual region. */
  id: string;
  category: FirewallCategory;
  decision: FirewallDecision;
  source: FirewallSource;
  confidence: number;
  reason: string;
  /** Bounding box from Phase 3 visual detection, if applicable. */
  boundingBox?: VisualBoundingBox;
  /** DOM element id from Phase 2, if applicable. */
  elementId?: string;
}

/**
 * Per-element redacted representation safe for outbound disclosure.
 * Mirrors Phase 1 SanitizedElement but enriched with firewall metadata.
 */
export interface FirewallSanitizedElement {
  id: string;
  tagName: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  label?: string;
  placeholder?: string;
  decision: FirewallDecision;
  category?: FirewallCategory;
  /** Redaction placeholder or undefined — NEVER the raw value. */
  value?: string;
  text?: string;
  isInteractive?: boolean;
  isVisible?: boolean;
}

/**
 * Safe visual region after redaction — coordinates preserved for action execution,
 * raw pixel data and raw label stripped if the region was sensitive.
 */
export interface FirewallVisualRegion {
  id: string;
  decision: FirewallDecision;
  category?: FirewallCategory;
  boundingBox: VisualBoundingBox;
  /** Safe label (e.g., 'person', 'car') for non-sensitive regions; '[REDACTED]' for sensitive. */
  label: string;
  confidence: number;
}

/**
 * Minimum Necessary Disclosure object — the only thing that may leave the device.
 * Contains NO raw PII, NO raw screenshot, NO raw pixel data.
 */
export interface MinimumDisclosure {
  page: {
    title: string;
    /** URL is included only if not a login/auth page heuristic. */
    url: string;
    domain?: string;
  };
  elements: FirewallSanitizedElement[];
  visualRegions: FirewallVisualRegion[];
  taskInstruction?: string;
  disclosedAt: number;
  firewallSummary: {
    totalDetections: number;
    blockedCount: number;
    maskedCount: number;
    allowedCount: number;
    visualRedactedCount: number;
  };
}

/**
 * Complete result returned by the Phase 4 firewall pipeline.
 */
export interface FirewallResult {
  success: boolean;
  disclosure?: MinimumDisclosure;
  detections: FirewallDetection[];
  error?: string;
  diagnostics: {
    status: 'PASS' | 'BLOCKED' | 'VALIDATION_FAILED';
    totalDetections: number;
    blockedCount: number;
    maskedCount: number;
    allowedCount: number;
    visualRedactedCount: number;
    timestamp: number;
  };
}

/**
 * Input accepted by the Phase 4 firewall pipeline.
 */
export interface FirewallInput {
  /** Phase 1 sanitized DOM context. */
  sanitizedContext: SanitizedContext;
  /** Phase 3 visual detections (may be empty array if perception was skipped). */
  visualDetections: VisualDetection[];
  /** Original screenshot dimensions, for redaction coordinate validation. */
  imageWidth?: number;
  imageHeight?: number;
  taskInstruction?: string;
}

/**
 * Validator result returned by the Phase 4 independent validator.
 */
export interface FirewallValidationResult {
  isValid: boolean;
  errors?: string[];
  validatedAt: number;
}
