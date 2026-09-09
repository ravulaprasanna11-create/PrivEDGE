/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Configuration
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Vision Transformer configuration and candidate visual sensitivity mappings.
 */

import type { VisualPerceptionConfig } from './types';

/**
 * Lightweight object-detection model for browser/edge inference.
 * facebook/detr-resnet-50 (Xenova quantized ONNX) produces real xmin/ymin/xmax/ymax
 * bounding boxes via the Transformers.js ObjectDetectionPipeline.
 * This is the minimum-viable spatially-capable model compatible with ONNX Runtime Web/WASM.
 * NOTE: MobileViT was classification-only and could NOT produce bounding boxes — replaced.
 */
export const DEFAULT_VISION_MODEL = 'Xenova/detr-resnet-50';

export const DEFAULT_PERCEPTION_CONFIG: VisualPerceptionConfig = {
  modelName: DEFAULT_VISION_MODEL,
  preferredRuntime: 'webgpu',
  confidenceThreshold: 0.35,
  maxDetections: 50
};

/**
 * Visual semantic labels that represent potential sensitive candidates.
 * Note: These are ONLY candidates for Phase 4 correlation, NOT confirmed PII.
 */
export const SENSITIVE_VISUAL_LABELS = new Set([
  'face',
  'portrait',
  'person',
  'avatar',
  'profile photo',
  'identity document',
  'card',
  'credit card',
  'debit card',
  'document',
  'text region',
  'signature',
  'qr code',
  'barcode',
  'input field',
  'password region',
  'credential box'
]);

/**
 * Checks if a given visual label matches potential sensitive candidate criteria.
 */
export function isSensitiveVisualCandidate(label: string): boolean {
  if (!label) return false;
  const normalized = label.toLowerCase().trim();
  for (const candidate of SENSITIVE_VISUAL_LABELS) {
    if (normalized.includes(candidate)) {
      return true;
    }
  }
  return false;
}
