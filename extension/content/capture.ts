/**
 * PRIVEDGE Phase 2: Browser Extension - Screen Capture Client
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Initiates visible tab screenshot requests from content script to background service worker.
 * Captures image data locally for Phase 3 visual perception without external network transmission.
 */

import type { CapturedScreen } from '../shared/types';
import { createExtensionMessage, MSG_CAPTURE_SCREEN } from '../background/messages';

// Reference chrome/browser global
declare const chrome: any;
declare const browser: any;

/**
 * Requests visible tab screenshot from extension background layer.
 */
export async function requestScreenCapture(): Promise<CapturedScreen> {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const height = typeof window !== 'undefined' ? window.innerHeight : 720;
  const timestamp = Date.now();

  const runtime = typeof chrome !== 'undefined' && chrome.runtime
    ? chrome.runtime
    : typeof browser !== 'undefined' && browser.runtime
    ? browser.runtime
    : null;

  if (!runtime || typeof runtime.sendMessage !== 'function') {
    return {
      dataUrl: '',
      width,
      height,
      timestamp
    };
  }

  const message = createExtensionMessage(MSG_CAPTURE_SCREEN, { width, height });

  return new Promise((resolve) => {
    try {
      runtime.sendMessage(message, (response: any) => {
        if (response && response.success && response.screen) {
          resolve(response.screen as CapturedScreen);
        } else {
          resolve({
            dataUrl: '',
            width,
            height,
            timestamp
          });
        }
      });
    } catch {
      resolve({
        dataUrl: '',
        width,
        height,
        timestamp
      });
    }
  });
}
