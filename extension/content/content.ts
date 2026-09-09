/**
 * PRIVEDGE Phase 2: Browser Extension - Content Script Entry Point
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Injected into active webpage. Captures DOM and accessibility context on-demand.
 * 
 * STRICT INVARIANTS:
 * - Capture occurs ONLY upon explicit extension request (no continuous tracking).
 * - ZERO external network requests.
 * - No data transmitted to third parties or remote endpoints.
 */

import { collectDOMContext } from './dom';
import { isValidExtensionMessage, MSG_CAPTURE_CONTEXT, MSG_EXECUTE_ACTION } from '../background/messages';
import { evaluateActionGuard } from '../guard/action-guard';
import { executeApprovedAction } from '../action/executor';

declare const chrome: any;
declare const browser: any;

export function initContentScriptListener(): void {
  const runtime = typeof chrome !== 'undefined' && chrome.runtime
    ? chrome.runtime
    : typeof browser !== 'undefined' && browser.runtime
    ? browser.runtime
    : null;

  if (!runtime || typeof runtime.onMessage?.addListener !== 'function') {
    return;
  }

  runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (res: unknown) => void) => {
    if (!isValidExtensionMessage(message)) {
      sendResponse({ success: false, error: 'Invalid extension message' });
      return false;
    }

    if (message.action === MSG_CAPTURE_CONTEXT) {
      try {
        const context = collectDOMContext(document, window);
        sendResponse({
          success: true,
          context,
          timestamp: Date.now()
        });
      } catch (err) {
        sendResponse({
          success: false,
          error: 'Failed to extract DOM context from webpage'
        });
      }
      return true; // Keep message channel open for asynchronous response
    }

    if (message.action === MSG_EXECUTE_ACTION) {
      const doc = typeof document !== 'undefined' ? document : undefined;
      const win = typeof window !== 'undefined' ? window : undefined;

      // 1. Local Action Guard gate
      const decision = evaluateActionGuard(message.payload, doc, win);

      if (!decision.approved) {
        sendResponse({
          success: false,
          error: decision.reason,
          decision,
          timestamp: Date.now(),
        });
        return false;
      }

      // 2. Safe Browser Action Execution
      executeApprovedAction(decision, doc, win)
        .then(result => {
          sendResponse({
            ...result,
            decision,
            timestamp: Date.now(),
          });
        })
        .catch(err => {
          sendResponse({
            success: false,
            error: (err as Error).message,
            decision,
            timestamp: Date.now(),
          });
        });

      return true; // Async response
    }

    return false;
  });
}

// Auto-initialize when loaded in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initContentScriptListener();
}
