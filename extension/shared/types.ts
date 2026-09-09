/**
 * PRIVEDGE Phase 2: Browser Extension - Shared Type Definitions
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Shared data models, messaging contracts, and minimal browser extension API typings.
 * Re-uses existing Phase 1 types for seamless pipeline integration.
 */

import type {
  BrowserContext,
  BrowserElement,
  PageMetadata,
  SanitizedContext,
  PipelineResult,
  SensitiveCategory,
  PrivacyDecision
} from '../../lib/privacy/types';

export type {
  BrowserContext,
  BrowserElement,
  PageMetadata,
  SanitizedContext,
  PipelineResult,
  SensitiveCategory,
  PrivacyDecision
};


/**
 * Screen capture representation (collected locally for Phase 3 visual perception).
 */
export interface CapturedScreen {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Accessibility-related metadata extracted from DOM elements.
 */
export interface AccessibilityContext {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaHidden?: boolean;
  associatedLabel?: string;
  accessibleName?: string;
}

/**
 * Extension message action identifiers.
 */
export type ExtensionMessageAction =
  | 'CAPTURE_CONTEXT'
  | 'CAPTURE_SCREEN'
  | 'CAPTURE_ALL'
  | 'RUN_VISUAL_PERCEPTION'
  | 'PRIVACY_RESULT'
  | 'CAPTURE_ERROR'
  | 'EXECUTE_ACTION'
  | 'ACTION_RESULT';

/**
 * Base extension message protocol.
 */
export interface ExtensionMessage<T = unknown> {
  action: ExtensionMessageAction;
  payload?: T;
  requestId?: string;
  timestamp: number;
}

/**
 * Result returned by the local capture and privacy pipeline orchestration.
 */
export interface ExtensionCaptureResult {
  success: boolean;
  page: PageMetadata;
  sanitizedContext?: SanitizedContext;
  screen?: CapturedScreen;
  diagnostics?: PipelineResult['diagnostics'];
  error?: string;
  /** Phase 4 Privacy Firewall result — present when firewall ran successfully. */
  firewallResult?: import('../../lib/firewall/types').FirewallResult;
}

/**
 * Minimal Chrome/Firefox WebExtension API typing to avoid external type dependencies.
 */
export interface MinimalChromeTab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
}

export interface MinimalChromeTabs {
  query(queryInfo: { active: boolean; currentWindow?: boolean }): Promise<MinimalChromeTab[]>;
  captureVisibleTab(
    windowId?: number | null,
    options?: { format?: 'png' | 'jpeg'; quality?: number }
  ): Promise<string>;
  sendMessage(tabId: number, message: unknown): Promise<unknown>;
}

export interface MinimalChromeScripting {
  executeScript(injection: {
    target: { tabId: number };
    files?: string[];
    func?: () => void;
  }): Promise<unknown[]>;
}

export interface MinimalChromeRuntime {
  onMessage: {
    addListener(
      callback: (
        message: unknown,
        sender: unknown,
        sendResponse: (response?: unknown) => void
      ) => boolean | void
    ): void;
  };
  sendMessage(message: unknown): Promise<unknown>;
}

export interface MinimalChrome {
  tabs: MinimalChromeTabs;
  runtime: MinimalChromeRuntime;
  scripting?: MinimalChromeScripting;
}
