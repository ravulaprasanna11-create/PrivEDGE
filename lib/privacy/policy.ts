/**
 * PRIVEDGE Phase 1: Local Privacy Core - Privacy Policy Engine
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Deterministic privacy policy mapping categories to explicit ALLOW, MASK, or BLOCK actions.
 * Rule: Task instructions can NEVER override a BLOCK decision.
 */

import type { DetectionResult, PrivacyDecision, SensitiveCategory } from './types';

export function applyPrivacyPolicy(category?: SensitiveCategory): PrivacyDecision {
  if (!category) {
    return 'ALLOW';
  }

  switch (category) {
    case 'PASSWORD':
    case 'AADHAAR':
    case 'PAN':
    case 'UNKNOWN_SENSITIVE':
      return 'BLOCK';

    case 'EMAIL':
    case 'PHONE':
    case 'NAME':
    case 'DOB':
    case 'ADDRESS':
      return 'MASK';

    default:
      // Fail closed for any unmapped category
      return 'BLOCK';
  }
}

export function evaluateElementPolicy(
  elementId: string,
  detections: DetectionResult[]
): { decision: PrivacyDecision; category?: SensitiveCategory; reason: string } {
  const elementDetections = detections.filter(d => d.elementId === elementId);

  if (elementDetections.length === 0) {
    return {
      decision: 'ALLOW',
      reason: 'Non-sensitive element'
    };
  }

  // If any detection requires BLOCK, decision MUST be BLOCK (highest precedence)
  const hasBlock = elementDetections.find(d => applyPrivacyPolicy(d.category) === 'BLOCK');
  if (hasBlock) {
    return {
      decision: 'BLOCK',
      category: hasBlock.category,
      reason: `Policy mandates BLOCK for sensitive category ${hasBlock.category}: ${hasBlock.reason}`
    };
  }

  // If any detection requires MASK, decision is MASK
  const hasMask = elementDetections.find(d => applyPrivacyPolicy(d.category) === 'MASK');
  if (hasMask) {
    return {
      decision: 'MASK',
      category: hasMask.category,
      reason: `Policy mandates MASK for category ${hasMask.category}: ${hasMask.reason}`
    };
  }

  return {
    decision: 'ALLOW',
    reason: 'Non-sensitive element'
  };
}
