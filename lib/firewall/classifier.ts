/**
 * PRIVEDGE Phase 4: Privacy Firewall — Detection Classifier
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Normalizes Phase 1 PII detections, Phase 2 DOM/accessibility metadata,
 * and Phase 3 visual detections into a unified FirewallDetection[].
 *
 * INVARIANTS:
 * - Raw sensitive values MUST NOT appear in output FirewallDetection objects.
 * - Source attribution must be accurate: DOM | RULE | VISUAL | COMBINED.
 * - ACCOUNT_NUMBER is detected via element metadata (autocomplete, labels, name attributes).
 * - FACE/person regions: DETR produces "person" labels — treated as privacy-sensitive
 *   visual spatial regions requiring local redaction. We do NOT claim face recognition.
 * - If Phase 3 model produces a "person" detection with sensitiveCandidate=true,
 *   it is handled as FACE (person spatial region) → MASK.
 */

import type { DetectionResult, SanitizedElement } from '../privacy/types';
import type { VisualDetection } from '../perception/types';
import type { FirewallDetection, FirewallCategory, FirewallSource } from './types';
import { applyFirewallPolicy } from './policy';

/**
 * Converts a Phase 1 SensitiveCategory string to FirewallCategory.
 * ACCOUNT_NUMBER is a Phase 4 extension; Phase 1 may emit it as UNKNOWN_SENSITIVE.
 */
function phase1CategoryToFirewall(
  cat: DetectionResult['category']
): FirewallCategory {
  // Direct mapping — Phase 1 categories are a strict subset of FirewallCategory
  const mapping: Record<DetectionResult['category'], FirewallCategory> = {
    PASSWORD: 'PASSWORD',
    AADHAAR: 'AADHAAR',
    PAN: 'PAN',
    EMAIL: 'EMAIL',
    PHONE: 'PHONE',
    DOB: 'DOB',
    ADDRESS: 'ADDRESS',
    NAME: 'NAME',
    UNKNOWN_SENSITIVE: 'UNKNOWN_SENSITIVE'
  };
  return mapping[cat] ?? 'UNKNOWN_SENSITIVE';
}

/** Keywords that indicate an account/bank number field in element metadata. */
const ACCOUNT_NUMBER_KEYWORDS = [
  'account', 'account_number', 'accountno', 'bank_account', 'ifsc', 'account_no', 'acno'
];

function containsAccountKeyword(text: string | undefined): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/[-_ ]+/g, '');
  return ACCOUNT_NUMBER_KEYWORDS.some(kw => normalized.includes(kw.replace(/[-_ ]+/g, '')));
}

/**
 * Classify Phase 1 detections into FirewallDetection[].
 */
export function classifyPhase1Detections(
  detections: DetectionResult[]
): FirewallDetection[] {
  return detections.map((d, i) => {
    const category = phase1CategoryToFirewall(d.category);
    const decision = applyFirewallPolicy(category);
    const source: FirewallSource = d.detectedPattern ? 'RULE' : 'DOM';
    return {
      id: `p1-${d.elementId}-${i}`,
      category,
      decision,
      source,
      confidence: d.confidence,
      reason: d.reason,
      elementId: d.elementId
    };
  });
}

/**
 * Classify Phase 2 DOM elements (already sanitized by Phase 1) for additional
 * signals the classifier can infer: password-type inputs, account number metadata.
 * Avoids re-reading raw values — operates only on sanitized element structure.
 */
export function classifyPhase2Elements(
  elements: SanitizedElement[]
): FirewallDetection[] {
  const detections: FirewallDetection[] = [];

  for (const el of elements) {
    // 1. Password type input — Phase 2 DOM structural metadata confirms password
    if (el.type?.toLowerCase() === 'password') {
      detections.push({
        id: `p2-pwd-${el.id}`,
        category: 'PASSWORD',
        decision: 'BLOCK',
        source: 'DOM',
        confidence: 1.0,
        reason: 'DOM input type="password" detected by Phase 2 classifier',
        elementId: el.id
      });
      continue; // password takes full precedence for this element
    }

    // 2. Account number detection via element metadata (name, ariaLabel, label, placeholder)
    const metaTexts = [el.ariaLabel, el.label, el.placeholder, el.id].filter(Boolean).join(' ');
    if (containsAccountKeyword(metaTexts)) {
      // Only add if not already captured by Phase 1 as another category
      if (!el.category) {
        detections.push({
          id: `p2-acct-${el.id}`,
          category: 'ACCOUNT_NUMBER',
          decision: applyFirewallPolicy('ACCOUNT_NUMBER'),
          source: 'DOM',
          confidence: 0.88,
          reason: 'Element metadata indicates bank account number field',
          elementId: el.id
        });
      }
    }

    // 3. Propagate already-determined Phase 1 decisions as Phase 2 DOM confirmations
    if (el.category && el.decision !== 'ALLOW') {
      const fwCategory = phase1CategoryToFirewall(
        el.category as DetectionResult['category']
      );
      detections.push({
        id: `p2-dom-${el.id}`,
        category: fwCategory,
        decision: applyFirewallPolicy(fwCategory),
        source: 'DOM',
        confidence: 0.95,
        reason: `Phase 2 DOM element carries Phase 1 category: ${el.category}`,
        elementId: el.id
      });
    }
  }

  return detections;
}

/**
 * Classify Phase 3 visual detections into FirewallDetection[].
 *
 * IMPORTANT — Model capability disclosure:
 * DETR (detr-resnet-50) is an object detector, not a face recogniser.
 * When the model returns label "person" with sensitiveCandidate=true,
 * we treat the spatial bounding box as a privacy-sensitive visual person region
 * and apply MASK (local spatial redaction).
 * We do NOT claim face recognition or identity detection.
 *
 * Non-sensitive labels (e.g. "car", "book") → SAFE → ALLOW.
 */
export function classifyPhase3Detections(
  visualDetections: VisualDetection[]
): FirewallDetection[] {
  return visualDetections.map(vd => {
    let category: FirewallCategory = 'SAFE';
    let reason = `Visual detection: ${vd.label}`;

    if (vd.sensitiveCandidate) {
      // Treat as a privacy-sensitive visual person region (spatial redaction only)
      category = 'FACE';
      reason = `Visual person region detected (label="${vd.label}") — local spatial redaction applied. Note: object detector used; no face recognition is performed.`;
    }

    const decision = applyFirewallPolicy(category);

    // Convert perception VisualBoundingBox {x,y,width,height} to firewall format {xmin,ymin,xmax,ymax}
    const bb = vd.boundingBox;

    return {
      id: `p3-${vd.id}`,
      category,
      decision,
      source: 'VISUAL' as FirewallSource,
      confidence: vd.confidence,
      reason,
      boundingBox: {
        x: bb.x,
        y: bb.y,
        width: bb.width,
        height: bb.height
      }
    };
  });
}

/**
 * Merge all phase-level detections into the canonical FirewallDetection[].
 * Where the same elementId has multiple detections, the combined decision is
 * the most-restrictive (BLOCK > MASK > ALLOW) — COMBINED source is assigned.
 */
export function mergeDetections(
  p1: FirewallDetection[],
  p2: FirewallDetection[],
  p3: FirewallDetection[]
): FirewallDetection[] {
  const all = [...p1, ...p2, ...p3];

  // Group by elementId for DOM detections, keep visual detections as-is
  const byElementId = new Map<string, FirewallDetection[]>();
  const visualOnly: FirewallDetection[] = [];

  for (const d of all) {
    if (d.elementId) {
      const existing = byElementId.get(d.elementId) ?? [];
      existing.push(d);
      byElementId.set(d.elementId, existing);
    } else {
      visualOnly.push(d);
    }
  }

  const merged: FirewallDetection[] = [];

  for (const [elementId, group] of byElementId.entries()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    // Pick the most-restrictive
    let dominant = group[0];
    for (const g of group.slice(1)) {
      const dominantScore = decisionScore(dominant.decision);
      const gScore = decisionScore(g.decision);
      if (gScore > dominantScore) {
        dominant = g;
      }
    }

    const sources = new Set(group.map(g => g.source));
    const source: FirewallSource = sources.size > 1 ? 'COMBINED' : dominant.source;

    merged.push({
      ...dominant,
      id: `combined-${elementId}`,
      source,
      reason: `Combined decision from ${group.length} detections on element ${elementId}`
    });
  }

  // Visual detections are kept as-is (they don't have elementId)
  return [...merged, ...visualOnly];
}

function decisionScore(d: FirewallDetection['decision']): number {
  return d === 'BLOCK' ? 2 : d === 'MASK' ? 1 : 0;
}
