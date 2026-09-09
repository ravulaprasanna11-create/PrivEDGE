/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Runtime Acceleration Layer
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Hardware acceleration detection and runtime selection.
 * Enforces deterministic WebGPU preference with graceful WASM fallback.
 * INVARIANT: Never claim WebGPU acceleration unless physically verified.
 */

import type { InferenceRuntime, RuntimeCapabilities } from './types';

/**
 * Verifies real hardware WebGPU capability on current device.
 */
export async function detectWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }

  try {
    const gpu = (navigator as any).gpu;
    if (!gpu || typeof gpu.requestAdapter !== 'function') {
      return false;
    }
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

/**
 * Verifies WebAssembly (WASM) capability in current environment.
 */
export function detectWASMSupport(): boolean {
  if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') {
    return false;
  }
  // Minimal valid WASM module verification (magic 0x00, 0x61, 0x73, 0x6d, version 0x01)
  const minimalWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  return WebAssembly.validate(minimalWasm);
}

/**
 * Resolves active runtime capabilities and chooses the optimal execution device.
 */
export async function getRuntimeCapabilities(
  preferredRuntime?: InferenceRuntime
): Promise<RuntimeCapabilities> {
  const [webgpuAvailable, wasmAvailable] = await Promise.all([
    detectWebGPUSupport(),
    Promise.resolve(detectWASMSupport())
  ]);

  let selectedRuntime: InferenceRuntime = 'wasm';
  let deviceInfo = 'CPU (WebAssembly fallback)';

  // Deterministic selection: WebGPU preferred if available and requested
  if (preferredRuntime === 'webgpu' || !preferredRuntime) {
    if (webgpuAvailable) {
      selectedRuntime = 'webgpu';
      deviceInfo = 'GPU (WebGPU hardware acceleration)';
    } else if (wasmAvailable) {
      selectedRuntime = 'wasm';
      deviceInfo = 'CPU (WebGPU unavailable, using WASM)';
    }
  } else if (preferredRuntime === 'wasm' && wasmAvailable) {
    selectedRuntime = 'wasm';
    deviceInfo = 'CPU (WASM explicitly requested)';
  }

  return {
    webgpuAvailable,
    wasmAvailable,
    selectedRuntime,
    deviceInfo
  };
}
