/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Public API
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Public interface for local browser inference, vision transformer detections,
 * WebGPU/WASM acceleration, and VisualContext processing.
 */

export {
  DEFAULT_VISION_MODEL,
  DEFAULT_PERCEPTION_CONFIG,
  SENSITIVE_VISUAL_LABELS,
  isSensitiveVisualCandidate
} from './config';

export {
  detectWebGPUSupport,
  detectWASMSupport,
  getRuntimeCapabilities
} from './runtime';

export { visionModelManager } from './model';

export {
  isValidBoundingBox,
  isValidVisualDetection,
  createVisualDetections
} from './detector';

export {
  validateScreenshotInput,
  isValidVisualContext,
  processVisualPerception
} from './processor';

export type {
  VisualBoundingBox,
  VisualDetection,
  VisualDetectionSource,
  InferenceRuntime,
  ModelLoadingState,
  VisualContext,
  VisualPerceptionConfig,
  ScreenshotInput,
  RuntimeCapabilities,
  ModelInstance
} from './types';
