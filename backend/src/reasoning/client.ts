/**
 * PRIVEDGE Phase 6 — Reasoning Client Manager
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Provides the active ReasoningProvider instance.
 * Allows mock provider injection for deterministic testing.
 */

import type { ReasoningProvider } from '../types/reasoning';
import { CloudReasoningProvider } from './provider';

let activeProvider: ReasoningProvider = new CloudReasoningProvider();

export function getReasoningProvider(): ReasoningProvider {
  return activeProvider;
}

export function setReasoningProvider(provider: ReasoningProvider): void {
  activeProvider = provider;
}

export function resetReasoningProvider(): void {
  activeProvider = new CloudReasoningProvider();
}
