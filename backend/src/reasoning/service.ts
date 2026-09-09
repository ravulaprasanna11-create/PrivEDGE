/**
 * PRIVEDGE Phase 6 — Cloud Reasoning Service
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Orchestrates:
 * SQLite Sanitized Context → Safe Reasoning Context → Provider → Parser/Validator → PENDING Action Storage.
 *
 * PRIVACY INVARIANT:
 * No raw DOM, raw screenshot, raw HTML, raw PII, tokens, or cookies may ever reach the provider.
 * NEVER executes actions (Phase 7). Action proposals remain PENDING.
 */

import { randomUUID } from 'crypto';
import { dbGet, dbRun } from '../db/database';
import type { ContextRow, SafeElement, SafeVisualRegion, SafePageMetadata, FirewallSummary, ActionRow } from '../types/api';
import type {
  SafeReasoningContext,
  StructuredActionProposal,
  ReasonApiRequest
} from '../types/reasoning';
import { getReasoningProvider } from './client';
import { parseAndValidateProposal, SAFE_FAILURE_PROPOSAL } from './parser';

export interface ExecuteReasoningResult {
  success: boolean;
  proposal: StructuredActionProposal;
  actionId?: string;
  status: 'pending' | 'none';
  stored: boolean;
  provider: string;
  durationMs?: number;
  error?: string;
}

export async function executeReasoning(req: ReasonApiRequest): Promise<ExecuteReasoningResult> {
  const { sessionId, taskId, userGoal } = req;

  // 1. Validate inputs
  if (!sessionId || typeof sessionId !== 'string') {
    return {
      success: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      status: 'none',
      stored: false,
      provider: 'none',
      error: 'sessionId is required.',
    };
  }

  if (!userGoal || typeof userGoal !== 'string' || !userGoal.trim()) {
    return {
      success: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      status: 'none',
      stored: false,
      provider: 'none',
      error: 'userGoal is required.',
    };
  }

  // 2. Validate session exists
  const session = dbGet('SELECT id FROM sessions WHERE id=?', [sessionId]);
  if (!session) {
    return {
      success: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      status: 'none',
      stored: false,
      provider: 'none',
      error: 'Session not found.',
    };
  }

  // 3. Validate task if provided
  if (taskId) {
    const task = dbGet('SELECT id FROM tasks WHERE id=?', [taskId]);
    if (!task) {
      return {
        success: false,
        proposal: SAFE_FAILURE_PROPOSAL,
        status: 'none',
        stored: false,
        provider: 'none',
        error: 'Task not found.',
      };
    }
  }

  // 4. Retrieve latest sanitized context for this session/task
  let contextRow: ContextRow | undefined;
  if (taskId) {
    contextRow = dbGet<ContextRow>(
      'SELECT * FROM sanitized_contexts WHERE session_id=? AND task_id=? ORDER BY created_at DESC LIMIT 1',
      [sessionId, taskId]
    );
  }
  if (!contextRow) {
    contextRow = dbGet<ContextRow>(
      'SELECT * FROM sanitized_contexts WHERE session_id=? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    );
  }

  if (!contextRow) {
    return {
      success: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      status: 'none',
      stored: false,
      provider: 'none',
      error: 'Sanitized context not found for session.',
    };
  }

  // 5. Parse stored sanitized context
  let pageMetadata: SafePageMetadata;
  let elements: SafeElement[];
  let visualRegions: SafeVisualRegion[] | undefined;
  let firewallSummary: FirewallSummary | undefined;

  try {
    pageMetadata = JSON.parse(contextRow.page_metadata) as SafePageMetadata;
    elements = JSON.parse(contextRow.structure) as SafeElement[];
    if (contextRow.sanitized_visual_context) {
      visualRegions = JSON.parse(contextRow.sanitized_visual_context) as SafeVisualRegion[];
    }
    if (contextRow.disclosure_metadata) {
      firewallSummary = JSON.parse(contextRow.disclosure_metadata) as FirewallSummary;
    }
  } catch (err) {
    return {
      success: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      status: 'none',
      stored: false,
      provider: 'none',
      error: 'Corrupted sanitized context in database.',
    };
  }

  // 6. Build strictly safe reasoning context (Fail closed)
  const safeContext: SafeReasoningContext = {
    userGoal: userGoal.trim(),
    page: {
      title: pageMetadata.titleSafe ?? pageMetadata.title,
      titleSafe: pageMetadata.titleSafe ?? pageMetadata.title,
      domain: pageMetadata.domain,
      url: pageMetadata.url ?? pageMetadata.urlOrigin,
      urlOrigin: pageMetadata.urlOrigin ?? pageMetadata.url,
      viewport: pageMetadata.viewport,
    },
    elements: elements.map(e => ({
      id: e.id ?? e.stableId,
      tagName: e.tagName,
      type: e.type,
      role: e.role,
      label: e.labelSafe ?? e.label,
      labelSafe: e.labelSafe ?? e.label,
      ariaLabel: e.ariaLabel,
      isInteractive: e.isInteractive,
      isVisible: e.isVisible,
      decision: e.decision,
      category: e.category,
    })),
    visualRegions: visualRegions?.map(v => ({
      id: v.id,
      label: v.label,
      decision: v.decision,
      category: v.category,
      boundingBox: v.boundingBox,
      confidence: v.confidence,
    })),
    firewallSummary,
  };

  // 7. Invoke provider
  const provider = getReasoningProvider();
  if (!provider.isConfigured()) {
    return {
      success: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      status: 'none',
      stored: false,
      provider: provider.name,
      error: 'Reasoning provider not configured: MODEL_API_KEY is missing.',
    };
  }

  const providerResult = await provider.reason(safeContext);

  if (!providerResult.success || !providerResult.rawText) {
    return {
      success: false,
      proposal: SAFE_FAILURE_PROPOSAL,
      status: 'none',
      stored: false,
      provider: provider.name,
      durationMs: providerResult.durationMs,
      error: providerResult.error ? `Provider error: ${providerResult.error}` : 'Provider failed to return reasoning output.',
    };
  }

  // 8. Validate structured output
  const validation = parseAndValidateProposal(providerResult.rawText, elements);

  if (!validation.valid) {
    return {
      success: false,
      proposal: validation.proposal,
      status: 'none',
      stored: false,
      provider: provider.name,
      durationMs: providerResult.durationMs,
      error: validation.error || 'Proposal validation failed.',
    };
  }

  const proposal = validation.proposal;

  // 9. If proposal is an action ('click' | 'scroll' | 'navigate'), store as PENDING
  let actionId: string | undefined;
  let stored = false;

  if (proposal.action !== 'none') {
    actionId = randomUUID();
    const now = Date.now();
    const safeTarget = JSON.stringify({
      elementId: proposal.action === 'click' ? proposal.targetElementId : undefined,
      scrollDelta: proposal.action === 'scroll' ? proposal.scrollDelta : undefined,
      url: proposal.action === 'navigate' ? proposal.url : undefined,
    });

    dbRun(
      'INSERT INTO actions (id,session_id,task_id,action_type,target,status,created_at) VALUES (?,?,?,?,?,?,?)',
      [actionId, sessionId, taskId ?? null, proposal.action, safeTarget, 'pending', now]
    );

    const row = dbGet<ActionRow>('SELECT * FROM actions WHERE id=?', [actionId]);
    if (row) {
      stored = true;
    }
  }

  return {
    success: true,
    proposal,
    actionId,
    status: proposal.action === 'none' ? 'none' : 'pending',
    stored,
    provider: provider.name,
    durationMs: providerResult.durationMs,
  };
}
