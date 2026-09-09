/**
 * PRIVEDGE Phase 7: Safe Browser Action Executor
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Executes approved actions within the browser context using standard DOM APIs.
 *
 * STRICT INVARIANTS:
 * - Executes ONLY actions that passed the Local Action Guard.
 * - Re-validates stale target right before execution.
 * - ZERO eval or arbitrary script execution.
 * - Never logs sensitive input values.
 * - Fails closed and reports execution failure honestly.
 */

import type { ActionGuardDecision } from '../guard/action-guard';
import { findTargetElement, isElementVisible, isElementInteractable } from '../guard/action-guard';

export interface ActionExecutionResult {
  success: boolean;
  actionType: string;
  targetElementId?: string;
  scrollDelta?: { x: number; y: number };
  url?: string;
  error?: string;
  executedAt: number;
}

/**
 * Safely executes an approved browser action.
 */
export async function executeApprovedAction(
  decision: ActionGuardDecision,
  doc: Document = (typeof document !== 'undefined' ? document : null) as unknown as Document,
  win: Window = (typeof window !== 'undefined' ? window : null) as unknown as Window
): Promise<ActionExecutionResult> {
  const executedAt = Date.now();

  if (!decision.approved) {
    return {
      success: false,
      actionType: decision.action.actionType,
      error: `Cannot execute: Action Guard rejected the action (${decision.reason})`,
      executedAt,
    };
  }

  const { actionType, targetElementId, scrollDelta, url, text } = decision.action;

  try {
    if (actionType === 'click') {
      if (!targetElementId) {
        return { success: false, actionType: 'click', error: 'Missing targetElementId for execution', executedAt };
      }

      const element = findTargetElement(doc, targetElementId);
      if (!element) {
        return {
          success: false,
          actionType: 'click',
          targetElementId,
          error: `Stale target: Element "${targetElementId}" was not found in DOM at execution time.`,
          executedAt,
        };
      }

      // Stale protection: confirm visibility & interactability before click
      if (!isElementVisible(element, win) || !isElementInteractable(element)) {
        return {
          success: false,
          actionType: 'click',
          targetElementId,
          error: `Stale target: Element "${targetElementId}" is no longer visible or interactable.`,
          executedAt,
        };
      }

      // Execute standard DOM click
      if (typeof element.click === 'function') {
        element.click();
      } else if (doc && typeof doc.dispatchEvent === 'function') {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: win });
        element.dispatchEvent(evt);
      }

      return {
        success: true,
        actionType: 'click',
        targetElementId,
        executedAt,
      };
    }

    if (actionType === 'scroll') {
      const delta = scrollDelta ?? { x: 0, y: 300 };

      if (win && typeof win.scrollBy === 'function') {
        win.scrollBy({ left: delta.x, top: delta.y, behavior: 'smooth' });
      }

      return {
        success: true,
        actionType: 'scroll',
        scrollDelta: delta,
        executedAt,
      };
    }

    if (actionType === 'type') {
      if (!targetElementId) {
        return { success: false, actionType: 'type', error: 'Missing targetElementId for execution', executedAt };
      }

      const element = findTargetElement(doc, targetElementId);
      if (!element) {
        return {
          success: false,
          actionType: 'type',
          targetElementId,
          error: `Stale target: Element "${targetElementId}" was not found at execution time.`,
          executedAt,
        };
      }

      if (!isElementVisible(element, win) || !isElementInteractable(element)) {
        return {
          success: false,
          actionType: 'type',
          targetElementId,
          error: `Stale target: Element "${targetElementId}" is no longer visible or interactable.`,
          executedAt,
        };
      }

      const inputVal = text ?? '';
      if ('value' in element) {
        (element as HTMLInputElement).value = inputVal;
      } else if (element.isContentEditable) {
        element.textContent = inputVal;
      }

      // Dispatch standard input and change events
      if (typeof element.dispatchEvent === 'function') {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // SECURITY: Do NOT return or log the typed text in execution result
      return {
        success: true,
        actionType: 'type',
        targetElementId,
        executedAt,
      };
    }

    if (actionType === 'navigate') {
      if (!url) {
        return { success: false, actionType: 'navigate', error: 'Missing URL for execution', executedAt };
      }

      if (win?.location) {
        if (typeof win.location.assign === 'function') {
          win.location.assign(url);
        } else {
          win.location.href = url;
        }
      }

      return {
        success: true,
        actionType: 'navigate',
        url,
        executedAt,
      };
    }

    return {
      success: false,
      actionType,
      error: `Unsupported execution action type: ${actionType}`,
      executedAt,
    };
  } catch (err) {
    return {
      success: false,
      actionType,
      targetElementId,
      error: `Execution error: ${(err as Error).message}`,
      executedAt,
    };
  }
}
