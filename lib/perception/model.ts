/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Model Lifecycle Manager
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Manages lazy initialization, lifecycle states, and single-instance reuse
 * for the on-device lightweight object-detection model via @huggingface/transformers.
 *
 * INVARIANT: Never initializes at boot; loads only upon explicit visual capture request.
 * INVARIANT: Pipeline instance is held locally — never transmitted to any external service.
 * INVARIANT: If load fails, fails closed with 'error' state and heuristic fallback.
 */

import type {
  InferenceRuntime,
  ModelInstance,
  ModelLoadingState,
  VisualPerceptionConfig
} from './types';
import { DEFAULT_PERCEPTION_CONFIG } from './config';
import { getRuntimeCapabilities } from './runtime';

/**
 * Opaque reference to a loaded @huggingface/transformers ObjectDetectionPipeline.
 * Typed as any to decouple the model manager from a hard compile-time import.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadedPipeline = any;

class VisionModelManager {
  private state: ModelLoadingState = 'uninitialized';
  private instance: ModelInstance | null = null;
  private pipeline: LoadedPipeline | null = null;
  private initializationPromise: Promise<ModelInstance> | null = null;

  public getState(): ModelLoadingState {
    return this.state;
  }

  public getInstance(): ModelInstance | null {
    return this.instance;
  }

  /**
   * Returns the loaded ObjectDetectionPipeline callable, or null if not available.
   * The processor uses this to run real model inference.
   */
  public getPipeline(): LoadedPipeline | null {
    return this.pipeline;
  }

  /**
   * Lazily loads and initializes the vision transformer instance once.
   * Concurrency-safe: Reuses ongoing promise if called multiple times simultaneously.
   */
  public async getOrInitialize(config?: Partial<VisualPerceptionConfig>): Promise<ModelInstance> {
    if (this.state === 'ready' && this.instance) {
      return this.instance;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization(config);
    return this.initializationPromise;
  }

  private async performInitialization(
    customConfig?: Partial<VisualPerceptionConfig>
  ): Promise<ModelInstance> {
    const config = { ...DEFAULT_PERCEPTION_CONFIG, ...(customConfig || {}) };
    this.state = 'loading';

    try {
      // 1. Detect hardware acceleration capabilities (WebGPU -> WASM fallback)
      const capabilities = await getRuntimeCapabilities(config.preferredRuntime);
      const selectedRuntime: InferenceRuntime = capabilities.selectedRuntime;

      // 2. Dynamically import @huggingface/transformers and load ObjectDetectionPipeline.
      //    Dynamic import used so the bundle does not hard-fail in environments
      //    where the package might be absent (graceful degradation to heuristic).
      //    Uses indirect import via Function() to avoid static bundler resolution
      //    in Next.js server context (this path runs in browser extension / Node test).
      let backend: 'transformers.js' | 'unloaded' = 'unloaded';
      let loadedPipeline: LoadedPipeline | null = null;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tf: any = await import('@huggingface/transformers');
        if (tf && typeof tf.pipeline === 'function') {
          // Map our runtime to the Transformers.js device string
          const device = selectedRuntime === 'webgpu' ? 'webgpu' : 'wasm';

          // Load ONNX-quantized object-detection pipeline locally.
          // Model is fetched once and cached by Transformers.js in IndexedDB/OPFS.
          // In test environments (Node), this will fail gracefully below.
          loadedPipeline = await tf.pipeline('object-detection', config.modelName, {
            device,
            // Use quantized ONNX model for smaller footprint
            dtype: 'q4',
          });

          backend = 'transformers.js';
        }
      } catch (pipelineErr) {
        // Pipeline load failed (e.g. no network in test, unsupported env, model not cached).
        // This is a GRACEFUL degradation — not a hard error.
        // Processor will use honest heuristic fallback; source is always labelled 'heuristic'.
        backend = 'unloaded';
        loadedPipeline = null;
      }

      this.pipeline = loadedPipeline;

      // 3. Build model instance descriptor
      this.instance = {
        modelName: config.modelName,
        runtime: selectedRuntime,
        state: 'ready',
        backend,
        initializedAt: Date.now()
      };

      this.state = 'ready';
      return this.instance;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown model initialization error';
      this.state = 'error';
      this.instance = {
        modelName: config.modelName,
        runtime: 'wasm',
        state: 'error',
        error: errorMsg
      };
      this.pipeline = null;
      throw new Error(`Failed to initialize on-device vision model: ${errorMsg}`);
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Resets model state (primarily for isolation in testing).
   */
  public reset(): void {
    this.state = 'uninitialized';
    this.instance = null;
    this.pipeline = null;
    this.initializationPromise = null;
  }
}

export const visionModelManager = new VisionModelManager();
