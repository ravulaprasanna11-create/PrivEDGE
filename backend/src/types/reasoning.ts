/**
 * PRIVEDGE Phase 6 — Cloud Reasoning / LLM-VLM Integration Types
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Server-side contracts for Phase 6 Reasoning.
 * INVARIANT: Never accepts or exposes raw DOM, raw screenshot, raw PII,
 * tokens, cookies, or FirewallInput.
 */

import type { SafeElement, SafeVisualRegion, SafePageMetadata, FirewallSummary, ActionType } from './api';

export type ReasoningActionType = ActionType | 'none';

/**
 * Structured Action Proposal returned by the Reasoning Engine
 */
export interface StructuredActionProposal {
  action: ReasoningActionType;
  targetElementId?: string;
  url?: string;
  scrollDelta?: { x: number; y: number };
  reason: string;
  confidence: number;
}

/**
 * Safe sanitized context passed to the reasoning provider.
 * Strictly derived from stored MinimumDisclosure / sanitized_contexts.
 */
export interface SafeReasoningContext {
  userGoal: string;
  page: SafePageMetadata;
  elements: Array<Pick<SafeElement, 'id' | 'tagName' | 'type' | 'role' | 'label' | 'labelSafe' | 'ariaLabel' | 'isInteractive' | 'isVisible' | 'decision' | 'category'>>;
  visualRegions?: Array<Pick<SafeVisualRegion, 'id' | 'label' | 'decision' | 'category' | 'boundingBox' | 'confidence'>>;
  firewallSummary?: FirewallSummary;
}

/**
 * Result from a reasoning provider invocation
 */
export interface ProviderReasoningResult {
  success: boolean;
  rawText?: string;
  error?: string;
  durationMs?: number;
}

/**
 * Reasoning Provider interface
 */
export interface ReasoningProvider {
  readonly name: string;
  isConfigured(): boolean;
  reason(context: SafeReasoningContext): Promise<ProviderReasoningResult>;
}

/**
 * Request payload for POST /api/reason
 */
export interface ReasonApiRequest {
  sessionId: string;
  taskId?: string;
  userGoal: string;
}

/**
 * Response payload for POST /api/reason
 */
export interface ReasonApiResponse {
  success: boolean;
  data?: {
    proposal: StructuredActionProposal;
    actionId?: string;
    status: 'pending' | 'none';
    stored: boolean;
    provider: string;
    durationMs?: number;
  };
  error?: string;
}
