/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Visual Element Detector
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Analyzes visual representations and produces structured VisualDetection models.
 * 
 * STRICT INVARIANTS:
 * - Clear source distinction: 'visual-model' vs 'heuristic'.
 * - Accurate candidate tagging (sensitiveCandidate: true/false).
 * - Never fabricates fake machine-learning accuracy.
 * - ZERO network transmission of pixel data.
 */

import type { VisualBoundingBox, VisualDetection, VisualDetectionSource } from './types';
import { isSensitiveVisualCandidate } from './config';

/**
 * Validates that a bounding box contains valid non-negative dimensions.
 */
export function isValidBoundingBox(box: unknown): box is VisualBoundingBox {
  if (!box || typeof box !== 'object') return false;
  const b = box as Partial<VisualBoundingBox>;
  return (
    typeof b.x === 'number' &&
    typeof b.y === 'number' &&
    typeof b.width === 'number' &&
    typeof b.height === 'number' &&
    !isNaN(b.x) &&
    !isNaN(b.y) &&
    !isNaN(b.width) &&
    !isNaN(b.height) &&
    b.x >= 0 &&
    b.y >= 0 &&
    b.width > 0 &&
    b.height > 0
  );
}

/**
 * Validates that a visual detection conforms strictly to the schema.
 */
export function isValidVisualDetection(detection: unknown): detection is VisualDetection {
  if (!detection || typeof detection !== 'object') return false;
  const d = detection as Partial<VisualDetection>;

  if (typeof d.id !== 'string' || !d.id.trim()) return false;
  if (typeof d.label !== 'string' || !d.label.trim()) return false;
  if (typeof d.confidence !== 'number' || isNaN(d.confidence) || d.confidence < 0 || d.confidence > 1) {
    return false;
  }
  if (d.source !== 'visual-model' && d.source !== 'heuristic') return false;
  if (typeof d.sensitiveCandidate !== 'boolean') return false;
  if (!isValidBoundingBox(d.boundingBox)) return false;

  return true;
}

export interface RawModelPrediction {
  label: string;
  score: number;
  box?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

/**
 * Transforms raw vision transformer outputs or heuristic visual regions
 * into verified VisualDetection instances.
 */
export function createVisualDetections(
  imageWidth: number,
  imageHeight: number,
  predictions?: RawModelPrediction[],
  heuristicRegions?: Array<{ label: string; confidence: number; box: VisualBoundingBox }>
): VisualDetection[] {
  const detections: VisualDetection[] = [];
  let counter = 1;

  // 1. Process actual model predictions
  if (Array.isArray(predictions)) {
    for (const pred of predictions) {
      const label = pred.label || 'visual-object';
      const confidence = Number(Math.max(0, Math.min(1, pred.score || 0)).toFixed(3));

      let boundingBox: VisualBoundingBox;
      if (pred.box) {
        boundingBox = {
          x: Math.max(0, Math.round(pred.box.xmin)),
          y: Math.max(0, Math.round(pred.box.ymin)),
          width: Math.max(1, Math.round(pred.box.xmax - pred.box.xmin)),
          height: Math.max(1, Math.round(pred.box.ymax - pred.box.ymin))
        };
      } else {
        // Full image classification without spatial boxes
        boundingBox = {
          x: 0,
          y: 0,
          width: Math.max(1, imageWidth),
          height: Math.max(1, imageHeight)
        };
      }

      if (isValidBoundingBox(boundingBox)) {
        detections.push({
          id: `vis-${counter++}`,
          label,
          confidence,
          boundingBox,
          source: 'visual-model',
          sensitiveCandidate: isSensitiveVisualCandidate(label)
        });
      }
    }
  }

  // 2. Process deterministic heuristic visual regions (if provided)
  if (Array.isArray(heuristicRegions)) {
    for (const region of heuristicRegions) {
      if (isValidBoundingBox(region.box)) {
        detections.push({
          id: `vis-${counter++}`,
          label: region.label,
          confidence: Number(Math.max(0, Math.min(1, region.confidence)).toFixed(3)),
          boundingBox: region.box,
          source: 'heuristic',
          sensitiveCandidate: isSensitiveVisualCandidate(region.label)
        });
      }
    }
  }

  return detections;
}
