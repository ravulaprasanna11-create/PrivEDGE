/**
 * PRIVEDGE Phase 1: Local Privacy Core - Minimum Disclosure Engine
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Task-conditioned minimum disclosure filters sanitized context to reveal
 * only the minimum necessary information required for the agent's task.
 * 
 * Invariant: Task requirements can REDUCE disclosure, but can NEVER override a BLOCK decision.
 */

import type { SanitizedContext, SanitizedElement } from './types';

export function applyMinimumDisclosure(
  context: SanitizedContext,
  taskInstruction?: string
): SanitizedContext {
  const instruction = (taskInstruction || context.taskInstruction || '').toLowerCase().trim();

  // If no task specified, apply baseline minimum disclosure
  if (!instruction) {
    return {
      ...context,
      elements: context.elements.map(minimizeElementDefault)
    };
  }

  const isClickOrNavigate = /\b(click|press|tap|submit|navigate|go to|open|continue|next|proceed)\b/i.test(instruction);
  const isSearchOrInspectField = /\b(find|locate|check|inspect|verify|see)\b/i.test(instruction);
  const mentionsEmail = /\bemail\b/i.test(instruction);

  const filteredElements = context.elements.map(el => {
    // SECURITY INVARIANT: BLOCK decisions can NEVER be overridden
    if (el.decision === 'BLOCK') {
      return {
        ...el,
        value: '[BLOCKED_SENSITIVE_DATA]',
        text: undefined,
        surroundingText: undefined
      };
    }

    // Specific Task: "Click Continue" / Action-oriented navigation
    if (isClickOrNavigate && !isSearchOrInspectField) {
      const isTargetButton = el.tagName.toLowerCase() === 'button' ||
                             el.role === 'button' ||
                             el.type === 'submit' ||
                             el.isInteractive;

      if (!isTargetButton && el.decision === 'MASK') {
        // Drop masked values for irrelevant sensitive fields during click navigation
        return {
          ...el,
          value: undefined,
          text: undefined,
          surroundingText: undefined
        };
      }
    }

    // Specific Task: "Find email field"
    if (mentionsEmail && el.category === 'EMAIL') {
      return {
        ...el,
        // Disclose element existence and whether it is populated, NOT actual email value
        value: el.isPopulated ? '[REDACTED_EMAIL]' : undefined,
        surroundingText: undefined
      };
    }

    // Default minimization for element
    return minimizeElementDefault(el);
  });

  return {
    ...context,
    taskInstruction: taskInstruction || context.taskInstruction,
    elements: filteredElements
  };
}

function minimizeElementDefault(el: SanitizedElement): SanitizedElement {
  if (el.decision === 'BLOCK') {
    return {
      ...el,
      value: '[BLOCKED_SENSITIVE_DATA]',
      text: undefined,
      surroundingText: undefined
    };
  }

  return {
    ...el,
    surroundingText: undefined
  };
}
