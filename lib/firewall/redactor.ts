/**
 * PRIVEDGE Phase 4: Privacy Firewall — DOM Sanitizer + Visual Redactor
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Sanitizes DOM elements and visual regions based on FirewallDetection decisions.
 * Deterministic — no randomization.
 *
 * INVARIANTS:
 * - BLOCK: sensitive value removed completely → '[BLOCKED_SENSITIVE_DATA]'
 * - MASK: sensitive value replaced by typed placeholder → '[REDACTED_*]'
 * - ALLOW: structural metadata preserved; inline PII still scanned and masked
 * - Raw sensitive values NEVER appear in any output field.
 * - Raw screenshot data is NEVER returned — visual redaction always applied locally.
 */

import type { SanitizedElement } from '../privacy/types';
import { sanitizeInlineText } from '../privacy/sanitizer';
import type {
  FirewallDetection,
  FirewallSanitizedElement,
  FirewallVisualRegion,
  FirewallCategory,
  FirewallDecision
} from './types';
import type { VisualBoundingBox } from '../perception/types';

/** Category-specific redaction placeholder tokens */
export const FIREWALL_PLACEHOLDERS: Record<FirewallCategory, string> = {
  PASSWORD: '[REDACTED_PASSWORD]',
  AADHAAR: '[REDACTED_AADHAAR]',
  PAN: '[REDACTED_PAN]',
  EMAIL: '[REDACTED_EMAIL]',
  PHONE: '[REDACTED_PHONE]',
  ACCOUNT_NUMBER: '[REDACTED_ACCOUNT]',
  DOB: '[REDACTED_DOB]',
  ADDRESS: '[REDACTED_ADDRESS]',
  NAME: '[REDACTED_NAME]',
  FACE: '[REDACTED_VISUAL_REGION]',
  UNKNOWN_SENSITIVE: '[REDACTED_SENSITIVE]',
  SAFE: '' // unused
};

export const BLOCKED_VALUE = '[BLOCKED_SENSITIVE_DATA]';

/**
 * Returns the appropriate value string for an element given its decision and category.
 * For BLOCK: always returns the blocked constant (removes raw value).
 * For MASK: returns the typed placeholder (does not expose original value).
 * For ALLOW: passes through inline-sanitized value only.
 */
function redactValue(
  rawValue: string | undefined,
  decision: FirewallDecision,
  category: FirewallCategory | undefined
): string | undefined {
  if (decision === 'BLOCK') {
    return BLOCKED_VALUE;
  }
  if (decision === 'MASK') {
    const placeholder = category ? FIREWALL_PLACEHOLDERS[category] : '[REDACTED_PII]';
    // Only expose the placeholder if there was actually a value
    return rawValue !== undefined ? placeholder : undefined;
  }
  // ALLOW — still run inline text sanitization as a last defence
  return rawValue !== undefined ? sanitizeInlineText(rawValue) : undefined;
}

/**
 * Sanitizes a single Phase 1 SanitizedElement according to the firewall decision.
 * The element's value is already Phase-1-sanitized; we re-apply Phase 4 placeholders.
 */
export function redactElement(
  element: SanitizedElement,
  detection: FirewallDetection | undefined
): FirewallSanitizedElement {
  const decision: FirewallDecision = detection?.decision ?? (element.decision as FirewallDecision);
  const category: FirewallCategory | undefined = detection?.category ?? (element.category as FirewallCategory | undefined);

  // The element.value is already sanitized by Phase 1; apply Phase 4 placeholder on top
  const sanitizedValue = redactValue(element.value, decision, category);

  return {
    id: element.id,
    tagName: element.tagName,
    type: element.type,
    role: element.role,
    ariaLabel: sanitizeInlineText(element.ariaLabel),
    label: sanitizeInlineText(element.label),
    placeholder: sanitizeInlineText(element.placeholder),
    decision,
    category,
    value: sanitizedValue,
    text: decision === 'BLOCK' ? undefined : sanitizeInlineText(element.text),
    isInteractive: element.isInteractive,
    isVisible: element.isVisible
  };
}

/**
 * Sanitizes all DOM elements using the firewall detections.
 * Any element not matched by a detection retains its Phase 1 decision.
 */
export function redactDomElements(
  elements: SanitizedElement[],
  detections: FirewallDetection[]
): FirewallSanitizedElement[] {
  // Index detections by elementId for O(1) lookup
  const detectionByElementId = new Map<string, FirewallDetection>();
  for (const d of detections) {
    if (!d.elementId) continue;
    const existing = detectionByElementId.get(d.elementId);
    if (!existing) {
      detectionByElementId.set(d.elementId, d);
    } else {
      // Keep most restrictive
      if (decisionScore(d.decision) > decisionScore(existing.decision)) {
        detectionByElementId.set(d.elementId, d);
      }
    }
  }

  return elements.map(el => redactElement(el, detectionByElementId.get(el.id)));
}

function decisionScore(d: FirewallDecision): number {
  return d === 'BLOCK' ? 2 : d === 'MASK' ? 1 : 0;
}

/**
 * Produces a redacted visual region metadata record from a visual firewall detection.
 * Pixel data is NOT stored — only coordinates and decision metadata.
 *
 * For MASK/BLOCK: label is replaced with '[REDACTED]'; bounding box coordinates
 * are preserved so a future rendering layer can apply opaque local redaction.
 *
 * Implementation note: Actual pixel blacking-out is performed by applyVisualRedaction()
 * using Canvas / ImageData (browser-side). This function produces the metadata record.
 */
export function buildVisualRegion(detection: FirewallDetection): FirewallVisualRegion {
  const isSensitive = detection.decision === 'MASK' || detection.decision === 'BLOCK';
  const bb = detection.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 };

  return {
    id: detection.id,
    decision: detection.decision,
    category: detection.category !== 'SAFE' ? detection.category : undefined,
    boundingBox: bb,
    label: isSensitive ? '[REDACTED]' : 'safe-region',
    confidence: detection.confidence
  };
}

/**
 * Applies local opaque visual redaction to a Canvas ImageData object.
 * Fills the bounding box region with fully-opaque black pixels.
 * This is a deterministic, browser-native operation — no external library required.
 *
 * Called "visual redaction" (not "blur") because it uses opaque pixel replacement.
 *
 * @param imageData - Mutable ImageData from a canvas context
 * @param box - The bounding box to redact (in image pixel coordinates)
 */
export function applyOpaqueRedaction(
  imageData: ImageData,
  box: VisualBoundingBox
): void {
  const { width: imgWidth, height: imgHeight, data } = imageData;
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(imgWidth, Math.floor(box.x + box.width));
  const y1 = Math.min(imgHeight, Math.floor(box.y + box.height));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const offset = (y * imgWidth + x) * 4;
      data[offset] = 0;       // R
      data[offset + 1] = 0;   // G
      data[offset + 2] = 0;   // B
      data[offset + 3] = 255; // A (fully opaque)
    }
  }
}

/**
 * Generates a redacted screenshot data URL by applying opaque black rectangles
 * over all sensitive visual regions using the Canvas API.
 *
 * INVARIANTS:
 * - The raw screenshot dataUrl is NEVER returned.
 * - If any error occurs, returns undefined (fail closed — no raw screenshot fallback).
 * - Only the redacted version may proceed.
 *
 * @param rawDataUrl - The original screenshot data URL (stays local, never returned)
 * @param sensitiveBoxes - List of bounding boxes to redact
 * @param imageWidth - Canvas width
 * @param imageHeight - Canvas height
 * @returns Redacted data URL, or undefined on failure
 */
export async function redactScreenshot(
  rawDataUrl: string,
  sensitiveBoxes: VisualBoundingBox[],
  imageWidth: number,
  imageHeight: number
): Promise<string | undefined> {
  // Only available in browser context with Canvas support
  if (typeof document === 'undefined') {
    // Non-browser environment (e.g., Node test) — cannot redact; return undefined (fail safe)
    return undefined;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = rawDataUrl;
    });

    ctx.drawImage(img, 0, 0);

    if (sensitiveBoxes.length > 0) {
      const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
      for (const box of sensitiveBoxes) {
        applyOpaqueRedaction(imageData, box);
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Return the redacted version only
    return canvas.toDataURL('image/png');
  } catch {
    // Fail closed — never return the raw screenshot as a fallback
    return undefined;
  }
}
