/**
 * PRIVEDGE Phase 8 — Statistical Metrics Computation
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Implements strict mathematical evaluation:
 * Precision = TP / (TP + FP)
 * Recall    = TP / (TP + FN)
 * F1        = 2 * (Precision * Recall) / (Precision + Recall)
 */

import type { PiiDetectionMetric, RedactionPrecisionMetric } from './types';
import type { SyntheticPiiTestCase } from './datasets';
import type { DetectionResult } from '../privacy/types';
import type { FirewallResult } from '../firewall/types';

export function computePrecision(tp: number, fp: number): number {
  if (tp + fp === 0) return 0;
  return Number((tp / (tp + fp)).toFixed(4));
}

export function computeRecall(tp: number, fn: number): number {
  if (tp + fn === 0) return 0;
  return Number((tp / (tp + fn)).toFixed(4));
}

export function computeF1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return Number(((2 * precision * recall) / (precision + recall)).toFixed(4));
}

/**
 * Evaluates Phase 1 & 4 PII detection precision and recall against ground-truth.
 */
export function evaluatePiiDetections(
  testCases: SyntheticPiiTestCase[],
  detections: DetectionResult[]
): PiiDetectionMetric {
  const detectionMap = new Map<string, DetectionResult[]>();
  detections.forEach(d => {
    const list = detectionMap.get(d.elementId) || [];
    list.push(d);
    detectionMap.set(d.elementId, list);
  });

  let totalTp = 0;
  let totalFp = 0;
  let totalFn = 0;

  const categoryBreakdown: PiiDetectionMetric['categoryBreakdown'] = {};

  for (const tc of testCases) {
    const isSensitiveGroundTruth = tc.expectedCategory !== 'SAFE';
    const elementDetections = detectionMap.get(tc.id) || [];
    const matchingDetection = elementDetections.find(d => d.category === tc.expectedCategory);
    const hasAnySensitiveDetection = elementDetections.length > 0;

    const cat = tc.expectedCategory;
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { tp: 0, fp: 0, fn: 0, precision: 0, recall: 0 };
    }

    if (isSensitiveGroundTruth) {
      if (matchingDetection) {
        totalTp++;
        categoryBreakdown[cat].tp++;
      } else {
        totalFn++;
        categoryBreakdown[cat].fn++;
      }
    } else {
      // Safe element
      if (hasAnySensitiveDetection) {
        totalFp++;
        categoryBreakdown[cat].fp++;
      }
    }
  }

  // Calculate per-category precision & recall
  for (const cat of Object.keys(categoryBreakdown)) {
    const c = categoryBreakdown[cat];
    c.precision = computePrecision(c.tp, c.fp);
    c.recall = computeRecall(c.tp, c.fn);
  }

  const precision = computePrecision(totalTp, totalFp);
  const recall = computeRecall(totalTp, totalFn);
  const f1Score = computeF1(precision, recall);

  return {
    status: 'MEASURED',
    precision,
    recall,
    f1Score,
    tp: totalTp,
    fp: totalFp,
    fn: totalFn,
    categoryBreakdown,
  };
}

/**
 * Evaluates Privacy Firewall redaction decisions.
 * Sensitive items correctly MASKED or BLOCKED are true redactions.
 * Non-sensitive items MASKED or BLOCKED are false redactions.
 * Sensitive items ALLOWED are missed sensitive items.
 */
export function evaluateRedactionDecisions(
  testCases: SyntheticPiiTestCase[],
  firewallResult: FirewallResult
): RedactionPrecisionMetric {
  if (!firewallResult.disclosure) {
    return {
      status: 'NOT MEASURED',
      precision: 0,
      correctRedactions: 0,
      falseRedactions: 0,
      missedSensitive: 0,
      totalElementsTested: testCases.length,
    };
  }

  const elementMap = new Map(firewallResult.disclosure.elements.map(e => [e.id, e]));

  let correctRedactions = 0;
  let falseRedactions = 0;
  let missedSensitive = 0;

  for (const tc of testCases) {
    const isSensitive = tc.expectedDecision === 'BLOCK' || tc.expectedDecision === 'MASK';
    const disclosed = elementMap.get(tc.id);

    const wasRedacted = disclosed ? disclosed.decision === 'BLOCK' || disclosed.decision === 'MASK' : false;

    if (isSensitive) {
      if (wasRedacted) {
        correctRedactions++;
      } else {
        missedSensitive++;
      }
    } else {
      // Should be ALLOW
      if (wasRedacted) {
        falseRedactions++;
      }
    }
  }

  const precision = computePrecision(correctRedactions, falseRedactions);

  return {
    status: 'MEASURED',
    precision,
    correctRedactions,
    falseRedactions,
    missedSensitive,
    totalElementsTested: testCases.length,
  };
}
