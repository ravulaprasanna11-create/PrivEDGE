/**
 * PRIVEDGE Phase 2: Browser Extension - Message Protocol
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Typed messaging protocol facilitating local communication between
 * Content Script, Popup, and Background Service Worker.
 */

import type { ExtensionMessage, ExtensionMessageAction } from '../shared/types';

export const MSG_CAPTURE_CONTEXT: ExtensionMessageAction = 'CAPTURE_CONTEXT';
export const MSG_CAPTURE_SCREEN: ExtensionMessageAction = 'CAPTURE_SCREEN';
export const MSG_CAPTURE_ALL: ExtensionMessageAction = 'CAPTURE_ALL';
export const MSG_RUN_VISUAL_PERCEPTION: ExtensionMessageAction = 'RUN_VISUAL_PERCEPTION';
export const MSG_PRIVACY_RESULT: ExtensionMessageAction = 'PRIVACY_RESULT';
export const MSG_CAPTURE_ERROR: ExtensionMessageAction = 'CAPTURE_ERROR';
export const MSG_EXECUTE_ACTION: ExtensionMessageAction = 'EXECUTE_ACTION';
export const MSG_ACTION_RESULT: ExtensionMessageAction = 'ACTION_RESULT';

const VALID_ACTIONS: Set<ExtensionMessageAction> = new Set([
  MSG_CAPTURE_CONTEXT,
  MSG_CAPTURE_SCREEN,
  MSG_CAPTURE_ALL,
  MSG_RUN_VISUAL_PERCEPTION,
  MSG_PRIVACY_RESULT,
  MSG_CAPTURE_ERROR,
  MSG_EXECUTE_ACTION,
  MSG_ACTION_RESULT
]);

/**
 * Creates a strongly typed extension message.
 */
export function createExtensionMessage<T = unknown>(
  action: ExtensionMessageAction,
  payload?: T,
  requestId?: string
): ExtensionMessage<T> {
  return {
    action,
    payload,
    requestId: requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: Date.now()
  };
}

/**
 * Validates that an incoming message conforms to the ExtensionMessage structure.
 * Rejects unknown actions or malformed objects.
 */
export function isValidExtensionMessage(msg: unknown): msg is ExtensionMessage {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return false;
  }

  const candidate = msg as Partial<ExtensionMessage>;

  if (typeof candidate.action !== 'string') {
    return false;
  }

  if (!VALID_ACTIONS.has(candidate.action as ExtensionMessageAction)) {
    return false;
  }

  if (typeof candidate.timestamp !== 'number' || isNaN(candidate.timestamp)) {
    return false;
  }

  return true;
}
