/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Type Definitions
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Strongly typed models for local browser inference, vision transformer detections,
 * WebGPU/WASM acceleration runtimes, and structured VisualContext representation.
 */

export interface VisualBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type VisualDetectionSource = 'visual-model' | 'heuristic';

export interface VisualDetection {
  id: string;
  label: string;
  confidence: number;
  boundingBox: VisualBoundingBox;
  source: VisualDetectionSource;
  sensitiveCandidate: boolean;
}

export type InferenceRuntime = 'webgpu' | 'wasm';

export type ModelLoadingState = 'uninitialized' | 'loading' | 'ready' | 'error';

export interface VisualContext {
  imageWidth: number;
  imageHeight: number;
  detections: VisualDetection[];
  inferenceTimeMs: number;
  runtime: InferenceRuntime;
  model: string;
  device: string;
  timestamp: number;
}

export interface VisualPerceptionConfig {
  modelName: string;
  preferredRuntime: InferenceRuntime;
  confidenceThreshold: number;
  maxDetections: number;
}

export interface ScreenshotInput {
  dataUrl: string;
  width?: number;
  height?: number;
  timestamp?: number;
}

export interface RuntimeCapabilities {
  webgpuAvailable: boolean;
  wasmAvailable: boolean;
  selectedRuntime: InferenceRuntime;
  deviceInfo: string;
}

export interface ModelInstance {
  modelName: string;
  runtime: InferenceRuntime;
  state: ModelLoadingState;
  backend?: 'transformers.js' | 'unloaded';
  error?: string;
  initializedAt?: number;
}

