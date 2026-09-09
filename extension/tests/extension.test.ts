/**
 * PRIVEDGE Phase 2: Browser Extension - Test Suite
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Standalone, dependency-free test suite verifying all 18 Phase 2 requirements
 * and the end-to-end integration between Extension Capture and Phase 1 Local Privacy Core.
 */

import assert from 'node:assert/strict';
import { collectDOMContext, isElementVisible, generateElementSelector } from '../content/dom';
import { extractAccessibilityContext, findAssociatedLabelText } from '../content/accessibility';
import {
  createExtensionMessage,
  isValidExtensionMessage,
  MSG_CAPTURE_CONTEXT,
  MSG_CAPTURE_SCREEN,
  MSG_CAPTURE_ALL,
  MSG_PRIVACY_RESULT
} from '../background/messages';
import { orchestrateContextCapture } from '../background/service-worker';
import { runLocalPrivacyPipeline } from '../../lib/privacy/pipeline';
import type { BrowserContext, MinimalChrome } from '../shared/types';

let passedTests = 0;
let failedTests = 0;

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ PASS: ${name}`);
      passedTests++;
    })
    .catch(error => {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(error);
      failedTests++;
    });
}

/**
 * Lightweight mock DOM element factory for headless testing.
 */
function createMockElement(options: {
  tagName: string;
  id?: string;
  type?: string;
  name?: string;
  value?: string;
  textContent?: string;
  placeholder?: string;
  autocomplete?: string;
  role?: string;
  ariaLabel?: string;
  ariaHidden?: string;
  hidden?: boolean;
  rect?: { width: number; height: number };
  attributes?: Record<string, string>;
}): any {
  const attrs: Record<string, string> = { ...(options.attributes || {}) };
  if (options.id) attrs.id = options.id;
  if (options.type) attrs.type = options.type;
  if (options.name) attrs.name = options.name;
  if (options.placeholder) attrs.placeholder = options.placeholder;
  if (options.autocomplete) attrs.autocomplete = options.autocomplete;
  if (options.role) attrs.role = options.role;
  if (options.ariaLabel) attrs['aria-label'] = options.ariaLabel;
  if (options.ariaHidden) attrs['aria-hidden'] = options.ariaHidden;
  if (options.hidden) attrs.hidden = 'true';

  const el = {
    tagName: options.tagName.toUpperCase(),
    id: options.id || '',
    name: options.name || '',
    value: options.value || '',
    textContent: options.textContent || '',
    parentElement: null as any,
    previousElementSibling: null as any,
    nextElementSibling: null as any,
    ownerDocument: null as any,
    getAttribute(attr: string) {
      return attrs[attr] || null;
    },
    hasAttribute(attr: string) {
      return attr in attrs;
    },
    getBoundingClientRect() {
      return options.rect || { width: 100, height: 30 };
    },
    closest(selector: string) {
      return null;
    }
  };

  return el;
}

/**
 * Creates a mock Document containing elements for testing.
 */
function createMockDocument(elements: any[], title = 'ISRO Agent Test Page', url = 'https://portal.isro.gov.in/form') {
  let hostname = 'portal.isro.gov.in';
  try {
    hostname = new URL(url).hostname;
  } catch {}

  const doc: any = {
    title,
    location: {
      href: url,
      hostname
    },
    querySelectorAll(selector: string) {
      return elements;
    },
    getElementById(id: string) {
      return elements.find(e => e.id === id) || null;
    },
    getElementsByTagName(tag: string) {
      return elements.filter(e => e.tagName.toLowerCase() === tag.toLowerCase());
    }
  };

  elements.forEach(el => {
    el.ownerDocument = doc;
  });

  return doc;
}

async function runAllTests() {
  console.log('====================================================');
  console.log('PRIVEDGE PHASE 2: BROWSER EXTENSION TEST SUITE');
  console.log('====================================================\n');

  // 1. Page metadata extraction
  await runTest('1. page metadata extraction', () => {
    const doc = createMockDocument([], 'Test ISRO Mission', 'https://isro.gov.in/chandrayaan');
    const context = collectDOMContext(doc);
    assert.equal(context.page.title, 'Test ISRO Mission');
    assert.equal(context.page.url, 'https://isro.gov.in/chandrayaan');
    assert.equal(context.page.domain, 'isro.gov.in');
  });

  // 2. Interactive element extraction
  await runTest('2. interactive element extraction', () => {
    const btn = createMockElement({ tagName: 'button', textContent: 'Launch Mission' });
    const input = createMockElement({ tagName: 'input', type: 'text', value: 'Satellite-1' });
    const link = createMockElement({ tagName: 'a', textContent: 'Docs', attributes: { href: '/docs' } });

    const doc = createMockDocument([btn, input, link]);
    const context = collectDOMContext(doc);

    assert.equal(context.elements.length, 3);
    assert.ok(context.elements.every(e => e.isInteractive === true));
  });

  // 3. Input metadata extraction
  await runTest('3. input metadata extraction', () => {
    const input = createMockElement({
      tagName: 'input',
      id: 'email-field',
      type: 'email',
      name: 'scientist_email',
      placeholder: 'Enter official email',
      autocomplete: 'email',
      value: 'scientist@isro.gov.in'
    });

    const doc = createMockDocument([input]);
    const context = collectDOMContext(doc);
    const captured = context.elements[0];

    assert.equal(captured.type, 'email');
    assert.equal(captured.name, 'scientist_email');
    assert.equal(captured.placeholder, 'Enter official email');
    assert.equal(captured.autocomplete, 'email');
    assert.equal(captured.value, 'scientist@isro.gov.in');
  });

  // 4. Visibility detection
  await runTest('4. visibility detection', () => {
    const visibleEl = createMockElement({ tagName: 'button', rect: { width: 100, height: 40 } });
    const hiddenAttrEl = createMockElement({ tagName: 'button', hidden: true });
    const ariaHiddenEl = createMockElement({ tagName: 'button', ariaHidden: 'true' });
    const zeroSizeEl = createMockElement({ tagName: 'button', rect: { width: 0, height: 0 } });

    assert.equal(isElementVisible(visibleEl), true);
    assert.equal(isElementVisible(hiddenAttrEl), false);
    assert.equal(isElementVisible(ariaHiddenEl), false);
    assert.equal(isElementVisible(zeroSizeEl), false);
  });

  // 5. Accessibility metadata extraction
  await runTest('5. accessibility metadata extraction', () => {
    const btn = createMockElement({
      tagName: 'button',
      role: 'button',
      ariaLabel: 'Authorize Operation',
      textContent: 'Go'
    });

    const a11y = extractAccessibilityContext(btn);
    assert.equal(a11y.role, 'button');
    assert.equal(a11y.ariaLabel, 'Authorize Operation');
    assert.equal(a11y.accessibleName, 'Authorize Operation');
  });

  // 6. Stable temporary element IDs
  await runTest('6. stable temporary element IDs', () => {
    const el1 = createMockElement({ tagName: 'input', type: 'text' });
    const el2 = createMockElement({ tagName: 'button' });
    const el3 = createMockElement({ tagName: 'input', type: 'password' });

    const doc = createMockDocument([el1, el2, el3]);
    const context = collectDOMContext(doc);

    assert.equal(context.elements[0].id, 'prv-1');
    assert.equal(context.elements[1].id, 'prv-2');
    assert.equal(context.elements[2].id, 'prv-3');
  });

  // 7. BrowserContext construction
  await runTest('7. BrowserContext construction', () => {
    const doc = createMockDocument([
      createMockElement({ tagName: 'input', type: 'text', name: 'user' })
    ]);
    const context = collectDOMContext(doc);

    assert.ok(context.page);
    assert.ok(Array.isArray(context.elements));
    assert.equal(typeof context.timestamp, 'number');
    assert.equal(context.elements.length, 1);
  });

  // 8. Sensitive field values remain local to the pipeline
  await runTest('8. sensitive field values remain local to the pipeline', () => {
    const rawSecret = 'ConfidentialMissionKey123#';
    const pwdInput = createMockElement({
      tagName: 'input',
      type: 'password',
      value: rawSecret
    });

    const doc = createMockDocument([pwdInput]);
    const context = collectDOMContext(doc);

    // Locally captured context holds value temporarily for inspection
    assert.equal(context.elements[0].value, rawSecret);

    // When piped to Phase 1, raw value is strictly eliminated
    const pipelineResult = runLocalPrivacyPipeline(context);
    assert.equal(pipelineResult.success, true);
    assert.ok(pipelineResult.outboundContext);

    const serializedOutbound = JSON.stringify(pipelineResult.outboundContext);
    assert.equal(serializedOutbound.includes(rawSecret), false);
  });

  // 9. Phase 1 pipeline receives captured BrowserContext
  await runTest('9. Phase 1 pipeline receives captured BrowserContext', () => {
    const doc = createMockDocument([
      createMockElement({ tagName: 'button', textContent: 'Confirm Mission' })
    ]);
    const context = collectDOMContext(doc);

    const result = runLocalPrivacyPipeline(context);
    assert.equal(result.success, true);
    assert.equal(result.diagnostics.status, 'SUCCESS');
  });

  // 10. Password field is blocked by Phase 1
  await runTest('10. password field is blocked by Phase 1', () => {
    const doc = createMockDocument([
      createMockElement({ tagName: 'input', type: 'password', value: 'MySecretPassword' })
    ]);
    const context = collectDOMContext(doc);
    const result = runLocalPrivacyPipeline(context);

    assert.equal(result.success, true);
    const blockedEl = result.outboundContext?.elements[0];
    assert.equal(blockedEl?.decision, 'BLOCK');
    assert.equal(blockedEl?.value, '[BLOCKED_SENSITIVE_DATA]');
  });

  // 11. Email is masked by Phase 1
  await runTest('11. email is masked by Phase 1', () => {
    const doc = createMockDocument([
      createMockElement({ tagName: 'input', type: 'email', value: 'isro_commander@isro.gov.in' })
    ]);
    const context = collectDOMContext(doc);
    const result = runLocalPrivacyPipeline(context);

    assert.equal(result.success, true);
    const maskedEl = result.outboundContext?.elements[0];
    assert.equal(maskedEl?.decision, 'MASK');
    assert.equal(maskedEl?.value, '[REDACTED_EMAIL]');
  });

  // 12. Aadhaar is blocked by Phase 1
  await runTest('12. Aadhaar is blocked by Phase 1', () => {
    const doc = createMockDocument([
      createMockElement({ tagName: 'input', name: 'aadhaar_no', value: '2345 6789 0123' })
    ]);
    const context = collectDOMContext(doc);
    const result = runLocalPrivacyPipeline(context);

    assert.equal(result.success, true);
    const aadhaarEl = result.outboundContext?.elements[0];
    assert.equal(aadhaarEl?.decision, 'BLOCK');
    assert.equal(aadhaarEl?.value, '[BLOCKED_SENSITIVE_DATA]');
  });

  // 13. PAN is blocked by Phase 1
  await runTest('13. PAN is blocked by Phase 1', () => {
    const doc = createMockDocument([
      createMockElement({ tagName: 'input', name: 'pan_card', value: 'ABCDE1234F' })
    ]);
    const context = collectDOMContext(doc);
    const result = runLocalPrivacyPipeline(context);

    assert.equal(result.success, true);
    const panEl = result.outboundContext?.elements[0];
    assert.equal(panEl?.decision, 'BLOCK');
    assert.equal(panEl?.value, '[BLOCKED_SENSITIVE_DATA]');
  });

  // 14. Safe button remains actionable
  await runTest('14. safe button remains actionable', () => {
    const doc = createMockDocument([
      createMockElement({ tagName: 'button', textContent: 'Continue' })
    ]);
    const context = collectDOMContext(doc);
    const result = runLocalPrivacyPipeline(context);

    assert.equal(result.success, true);
    const btnEl = result.outboundContext?.elements[0];
    assert.equal(btnEl?.decision, 'ALLOW');
    assert.equal(btnEl?.isInteractive, true);
  });

  // 15. Screenshot capture message flow is correctly structured
  await runTest('15. screenshot capture message flow is correctly structured', async () => {
    const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const mockChrome: MinimalChrome = {
      tabs: {
        async query() {
          return [{ id: 101, url: 'https://isro.gov.in', active: true }];
        },
        async captureVisibleTab() {
          return mockDataUrl;
        },
        async sendMessage(tabId: number, msg: any) {
          return {
            success: true,
            context: {
              page: { url: 'https://isro.gov.in', title: 'ISRO' },
              elements: [{ id: 'prv-1', tagName: 'button', text: 'Proceed', isInteractive: true }]
            }
          };
        }
      },
      runtime: {
        onMessage: { addListener() {} },
        async sendMessage() { return null; }
      }
    };

    const captureResult = await orchestrateContextCapture(mockChrome, 101);
    assert.equal(captureResult.success, true);
    assert.ok(captureResult.screen);
    assert.equal(captureResult.screen?.dataUrl, mockDataUrl);
    assert.equal(captureResult.screen?.width, 1280);
    assert.equal(captureResult.screen?.height, 720);
  });

  // 16. Invalid extension messages are rejected
  await runTest('16. invalid extension messages are rejected', () => {
    assert.equal(isValidExtensionMessage(null), false);
    assert.equal(isValidExtensionMessage('invalid'), false);
    assert.equal(isValidExtensionMessage({}), false);
    assert.equal(isValidExtensionMessage({ action: 'UNKNOWN_ACTION', timestamp: Date.now() }), false);
    assert.equal(isValidExtensionMessage({ action: MSG_CAPTURE_ALL, timestamp: 'invalid' }), false);

    const validMsg = createExtensionMessage(MSG_CAPTURE_ALL);
    assert.equal(isValidExtensionMessage(validMsg), true);
  });

  // 17. No raw PII appears in sanitized output
  await runTest('17. no raw PII appears in sanitized output', async () => {
    const rawAadhaar = '9999 8888 7777';
    const rawPan = 'ZXCVB9876Q';
    const rawPassword = 'SecretP@ssword2026!';
    const rawEmail = 'payload_leak@isro.res.in';

    const mockContext: BrowserContext = {
      page: { url: 'https://secure.isro.gov.in', title: 'Classified Mission' },
      elements: [
        { id: 'prv-1', tagName: 'input', type: 'password', value: rawPassword },
        { id: 'prv-2', tagName: 'input', name: 'aadhaar', value: rawAadhaar },
        { id: 'prv-3', tagName: 'input', name: 'pan', value: rawPan },
        { id: 'prv-4', tagName: 'input', type: 'email', value: rawEmail }
      ]
    };

    const mockChrome: MinimalChrome = {
      tabs: {
        async query() {
          return [{ id: 42, active: true }];
        },
        async captureVisibleTab() {
          return 'data:image/png;base64,mock';
        },
        async sendMessage() {
          return { success: true, context: mockContext };
        }
      },
      runtime: {
        onMessage: { addListener() {} },
        async sendMessage() { return null; }
      }
    };

    const result = await orchestrateContextCapture(mockChrome, 42);
    assert.equal(result.success, true);
    assert.ok(result.sanitizedContext);

    const serializedOutbound = JSON.stringify(result.sanitizedContext);
    assert.equal(serializedOutbound.includes(rawAadhaar), false, 'Raw Aadhaar leaked in sanitized context!');
    assert.equal(serializedOutbound.includes(rawPan), false, 'Raw PAN leaked in sanitized context!');
    assert.equal(serializedOutbound.includes(rawPassword), false, 'Raw Password leaked in sanitized context!');
    assert.equal(serializedOutbound.includes(rawEmail), false, 'Raw Email leaked in sanitized context!');
  });

  // 18. No raw PII appears in diagnostics
  await runTest('18. no raw PII appears in diagnostics', async () => {
    const rawSecret = 'SecretPasswordNeverLeakInDiagnostics#';
    const mockContext: BrowserContext = {
      page: { url: 'https://portal.isro.gov.in', title: 'Diagnostics Test' },
      elements: [
        { id: 'prv-1', tagName: 'input', type: 'password', value: rawSecret }
      ]
    };

    const mockChrome: MinimalChrome = {
      tabs: {
        async query() {
          return [{ id: 77, active: true }];
        },
        async captureVisibleTab() {
          return 'data:image/png;base64,mock';
        },
        async sendMessage() {
          return { success: true, context: mockContext };
        }
      },
      runtime: {
        onMessage: { addListener() {} },
        async sendMessage() { return null; }
      }
    };

    const result = await orchestrateContextCapture(mockChrome, 77);
    assert.ok(result.diagnostics);

    const serializedDiag = JSON.stringify(result.diagnostics);
    assert.equal(serializedDiag.includes(rawSecret), false, 'Raw secret leaked in diagnostics!');
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests} passed / ${failedTests} failed`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();
