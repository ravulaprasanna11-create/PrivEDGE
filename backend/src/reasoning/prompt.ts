/**
 * PRIVEDGE Phase 6 — Reasoning Prompt Engineering
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Compact, safe prompt generation for Cloud LLM/VLM.
 * INVARIANT: Never requests, contains, or accepts raw PII, raw DOM, or raw screenshots.
 */

import type { SafeReasoningContext } from '../types/reasoning';

export const SYSTEM_PROMPT = `You are a browser-task reasoning engine for PRIVEDGE.
1. The supplied browser context is sanitized by the local privacy firewall.
2. Never request or infer hidden PII, credentials, passwords, tokens, or cookies.
3. Never output passwords, tokens, cookies, or sensitive values.
4. Select ONLY actions supported by the provided context: 'click', 'scroll', 'navigate', or 'none'.
5. Prefer safe, visible, interactive elements.
6. Do NOT invent element IDs. Use ONLY IDs present in the element list.
7. Return ONLY a single raw JSON object matching the required schema. No Markdown backticks, no prose.
8. If the task cannot be safely or clearly completed with the given elements, return action 'none'.
9. Do not execute actions; propose a single next step only.

Required JSON format:
{
  "action": "click" | "scroll" | "navigate" | "none",
  "targetElementId": "string (required if action is click)",
  "url": "string (required if action is navigate, must be safe http/https URL)",
  "scrollDelta": { "x": 0, "y": 300 } (optional, if action is scroll),
  "reason": "short explanation of the step",
  "confidence": 0.0 to 1.0
}`;

/**
 * Builds the user prompt from safe sanitized context.
 */
export function buildReasoningPrompt(context: SafeReasoningContext): string {
  const safeElements = context.elements.map(e => ({
    id: e.id,
    tagName: e.tagName,
    role: e.role,
    label: e.labelSafe ?? e.label,
    isInteractive: e.isInteractive,
    isVisible: e.isVisible,
    decision: e.decision,
    category: e.category,
  }));

  const payload: Record<string, unknown> = {
    userGoal: context.userGoal,
    page: {
      title: context.page.titleSafe ?? context.page.title,
      domain: context.page.domain,
      url: context.page.url ?? context.page.urlOrigin,
    },
    interactiveElements: safeElements,
  };

  if (context.visualRegions && context.visualRegions.length > 0) {
    payload.visualRegions = context.visualRegions.map(v => ({
      id: v.id,
      label: v.label,
      decision: v.decision,
      boundingBox: v.boundingBox,
      confidence: v.confidence,
    }));
  }

  if (context.firewallSummary) {
    payload.firewallSummary = context.firewallSummary;
  }

  return JSON.stringify(payload, null, 2);
}
