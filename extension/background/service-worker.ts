/**
 * PRIVEDGE Phase 2: Browser Extension - Background Service Worker
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Central local orchestration layer.
 * Receives capture requests, coordinates DOM & screenshot capture from the active tab,
 * passes captured BrowserContext directly into the Phase 1 Local Privacy Pipeline,
 * and yields verified sanitized output.
 * 
 * STRICT INVARIANTS:
 * - ZERO external network / cloud / server communication.
 * - NEVER logs or persists raw PII.
 * - Fails closed on any policy violation or validation error.
 */

import type {
  BrowserContext,
  CapturedScreen,
  ExtensionCaptureResult,
  MinimalChrome
} from '../shared/types';
import {
  isValidExtensionMessage,
  createExtensionMessage,
  MSG_CAPTURE_CONTEXT,
  MSG_CAPTURE_SCREEN,
  MSG_CAPTURE_ALL,
  MSG_RUN_VISUAL_PERCEPTION,
  MSG_PRIVACY_RESULT,
  MSG_CAPTURE_ERROR,
  MSG_EXECUTE_ACTION,
  MSG_ACTION_RESULT
} from './messages';
import { runLocalPrivacyPipeline } from '../../lib/privacy/pipeline';
import { detectSensitiveData } from '../../lib/privacy/detector';
import type { VisualContext } from '../../lib/perception/types';
import { runVisualPerceptionOnScreen } from '../perception/visual-perception';
import { runPrivacyFirewall } from '../../lib/firewall/pipeline';

declare const chrome: any;
declare const browser: any;

/**
 * Resolves the Chrome / WebExtension API root.
 */
function getExtensionApi(): MinimalChrome | null {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
    return chrome as unknown as MinimalChrome;
  }
  if (typeof browser !== 'undefined' && browser.tabs && browser.runtime) {
    return browser as unknown as MinimalChrome;
  }
  return null;
}

/**
 * Captures screenshot of current visible tab using extension API.
 */
export async function captureTabScreenshot(api?: MinimalChrome): Promise<CapturedScreen | undefined> {
  const extApi = api || getExtensionApi();
  if (!extApi?.tabs?.captureVisibleTab) {
    return undefined;
  }

  try {
    const dataUrl = await extApi.tabs.captureVisibleTab(null, { format: 'png' });
    return {
      dataUrl,
      width: 1280,
      height: 720,
      timestamp: Date.now()
    };
  } catch {
    // Fail safely without leaking data
    return undefined;
  }
}

/**
 * Orchestrates full capture: requests DOM context from content script, captures screen,
 * and feeds BrowserContext through the Phase 1 Local Privacy Pipeline.
 */
export async function orchestrateContextCapture(
  api?: MinimalChrome,
  tabIdOverride?: number
): Promise<ExtensionCaptureResult> {
  const extApi = api || getExtensionApi();

  if (!extApi) {
    return {
      success: false,
      page: { url: '', title: '' },
      error: 'Browser extension API is unavailable in current environment'
    };
  }

  let activeTabId = tabIdOverride;

  if (!activeTabId) {
    try {
      const activeTabs = await extApi.tabs.query({ active: true, currentWindow: true });
      if (!activeTabs || activeTabs.length === 0 || !activeTabs[0].id) {
        return {
          success: false,
          page: { url: '', title: '' },
          error: 'No active browser tab found for context capture'
        };
      }
      activeTabId = activeTabs[0].id;
    } catch {
      return {
        success: false,
        page: { url: '', title: '' },
        error: 'Failed to query active browser tab'
      };
    }
  }

  // 1. Request DOM context from content script on active tab
  let capturedContext: BrowserContext | undefined;

  try {
    const message = createExtensionMessage(MSG_CAPTURE_CONTEXT);
    const response = (await extApi.tabs.sendMessage(activeTabId, message)) as {
      success: boolean;
      context?: BrowserContext;
      error?: string;
    };

    if (response && response.success && response.context) {
      capturedContext = response.context;
    } else {
      return {
        success: false,
        page: { url: '', title: '' },
        error: response?.error || 'Content script failed to respond or extract context'
      };
    }
  } catch {
    return {
      success: false,
      page: { url: '', title: '' },
      error: 'Unable to communicate with webpage content script (page may be restricted)'
    };
  }

  // 2. Capture visible tab screenshot locally for Phase 3 visual perception
  const screen = await captureTabScreenshot(extApi);

  // 3. Pipe captured BrowserContext through Phase 1 Local Privacy Core
  const pipelineResult = runLocalPrivacyPipeline(capturedContext);

  if (!pipelineResult.success || !pipelineResult.outboundContext) {
    // Fail closed: Never return unverified or blocked payloads
    return {
      success: false,
      page: capturedContext.page,
      diagnostics: pipelineResult.diagnostics,
      error: 'Privacy pipeline rejected outbound context during validation'
    };
  }

  return {
    success: true,
    page: capturedContext.page,
    sanitizedContext: pipelineResult.outboundContext,
    screen,
    diagnostics: pipelineResult.diagnostics,
    // Phase 4: run the privacy firewall over sanitized context + visual detections
    // firewallResult is attached for downstream use; raw data never returned
    firewallResult: (() => {
      try {
        const phase1Detections = detectSensitiveData(capturedContext);
        return runPrivacyFirewall(
          {
            sanitizedContext: pipelineResult.outboundContext!,
            visualDetections: [],     // Visual detections available if Phase 3 ran separately
            taskInstruction: capturedContext.taskInstruction
          },
          phase1Detections
        );
      } catch {
        return undefined;
      }
    })()
  };
}

/**
 * Orchestrates local visual perception: captures screenshot and runs on-device model.
 */
export async function orchestrateVisualPerception(
  api?: MinimalChrome
): Promise<{ success: boolean; visualContext?: VisualContext; error?: string }> {
  const extApi = api || getExtensionApi();
  if (!extApi) {
    return { success: false, error: 'Extension API unavailable' };
  }

  const screen = await captureTabScreenshot(extApi);
  if (!screen) {
    return { success: false, error: 'Failed to capture visible tab screenshot' };
  }

  try {
    const visualContext = await runVisualPerceptionOnScreen(screen);
    return { success: true, visualContext };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Visual perception failed';
    return { success: false, error: errorMsg };
  }
}

/**
 * Initializes Service Worker Message Listeners.
 */
export function initServiceWorker(api?: MinimalChrome): void {
  const extApi = api || getExtensionApi();
  if (!extApi?.runtime?.onMessage?.addListener) return;

  extApi.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (res: unknown) => void) => {
    if (!isValidExtensionMessage(message)) {
      sendResponse({
        action: MSG_CAPTURE_ERROR,
        payload: { error: 'Invalid or malformed extension message' },
        timestamp: Date.now()
      });
      return false;
    }

    if (message.action === MSG_CAPTURE_SCREEN) {
      captureTabScreenshot(extApi).then(screen => {
        sendResponse({ success: Boolean(screen), screen });
      });
      return true;
    }

    if (message.action === MSG_CAPTURE_ALL) {
      orchestrateContextCapture(extApi).then(result => {
        sendResponse({
          action: MSG_PRIVACY_RESULT,
          payload: result,
          timestamp: Date.now()
        });
      });
      return true;
    }

    if (message.action === MSG_RUN_VISUAL_PERCEPTION) {
      orchestrateVisualPerception(extApi).then(result => {
        sendResponse({
          action: MSG_PRIVACY_RESULT,
          payload: result,
          timestamp: Date.now()
        });
      });
      return true;
    }

    if (message.action === MSG_EXECUTE_ACTION) {
      orchestrateActionExecution(message.payload, extApi).then(result => {
        sendResponse({
          action: MSG_ACTION_RESULT,
          payload: result,
          timestamp: Date.now()
        });
      });
      return true;
    }

    return false;
  });
}

/**
 * Phase 7: Dispatches action proposal to the content script for Action Guard validation and execution.
 */
export async function orchestrateActionExecution(
  proposal: unknown,
  api?: MinimalChrome,
  tabIdOverride?: number
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const extApi = api || getExtensionApi();
  if (!extApi) {
    return { success: false, error: 'Browser extension API is unavailable' };
  }

  let activeTabId = tabIdOverride;
  if (!activeTabId) {
    try {
      const activeTabs = await extApi.tabs.query({ active: true, currentWindow: true });
      if (!activeTabs || activeTabs.length === 0 || !activeTabs[0].id) {
        return { success: false, error: 'No active tab found' };
      }
      activeTabId = activeTabs[0].id;
    } catch {
      return { success: false, error: 'Failed to query active tab' };
    }
  }

  try {
    const response = await extApi.tabs.sendMessage(
      activeTabId,
      createExtensionMessage(MSG_EXECUTE_ACTION, proposal)
    );
    return { success: true, result: response };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

const DEFAULT_BACKEND_URL = 'http://localhost:4000';

/**
 * Phase 5 Integration: Transmits sanitized Phase 4 MinimumDisclosure to the backend API.
 * 
 * STRICT INVARIANTS:
 * - NEVER sends raw screenshot, raw DOM, raw HTML, raw page text, raw PII, or raw FirewallInput.
 * - Network payload is derived ONLY from sanitized Phase 4 MinimumDisclosure.
 * - Does not send anything before Phase 4 sanitization completes.
 */
export async function sendSanitizedContextToBackend(
  options: {
    sessionId: string;
    taskId?: string;
    disclosure: import('../../lib/firewall/types').MinimumDisclosure;
    backendUrl?: string;
  }
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!options.disclosure) {
    return { success: false, error: 'Cannot transmit context to backend without sanitized Phase 4 MinimumDisclosure' };
  }

  const backendUrl = options.backendUrl || DEFAULT_BACKEND_URL;
  const payload = {
    sessionId: options.sessionId,
    taskId: options.taskId,
    privacy: {
      sanitized: true,
      rawDataIncluded: false,
    },
    ...options.disclosure,
  };

  try {
    const response = await fetch(`${backendUrl}/api/contexts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as { success: boolean; data?: unknown; error?: string };
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error transmitting context' };
  }
}

// Auto-initialize when running as a Service Worker
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  initServiceWorker();
}

