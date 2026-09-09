/**
 * PRIVEDGE Phase 7: Local Action Guard & Browser Execution Test Suite
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Standalone test suite verifying deterministic local security boundaries,
 * policy checks, stale-target protection, URL validation, and safe browser execution.
 *
 * Run: node --experimental-strip-types --no-warnings extension/tests/action-guard.test.ts
 */

import assert from 'node:assert/strict';
import { evaluateActionGuard } from '../guard/action-guard';
import { executeApprovedAction } from '../action/executor';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    })
    .catch(error => {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(error);
      failed++;
    });
}

/**
 * Creates a mock HTMLElement for testing.
 */
function createMockElement(options: {
  tagName: string;
  id?: string;
  dataPrvId?: string;
  type?: string;
  disabled?: boolean;
  ariaDisabled?: string;
  hidden?: boolean;
  ariaHidden?: string;
  rect?: { width: number; height: number };
  value?: string;
}): any {
  const attrs: Record<string, string> = {};
  if (options.id) attrs['id'] = options.id;
  if (options.dataPrvId) attrs['data-prv-id'] = options.dataPrvId;
  if (options.type) attrs['type'] = options.type;
  if (options.ariaDisabled) attrs['aria-disabled'] = options.ariaDisabled;
  if (options.ariaHidden) attrs['aria-hidden'] = options.ariaHidden;
  if (options.hidden) attrs['hidden'] = 'true';

  let clicked = false;
  let textContent = '';
  let val = options.value || '';

  const el: any = {
    tagName: options.tagName.toUpperCase(),
    id: options.id || '',
    type: options.type || '',
    disabled: Boolean(options.disabled),
    value: val,
    textContent,
    isContentEditable: false,
    ownerDocument: null as any,
    getAttribute(attr: string) {
      return attrs[attr] || null;
    },
    hasAttribute(attr: string) {
      return attr in attrs;
    },
    getBoundingClientRect() {
      return options.rect || { width: 100, height: 35 };
    },
    click() {
      clicked = true;
    },
    isClicked() {
      return clicked;
    },
    dispatchEvent(evt: any) {
      if (evt.type === 'click') clicked = true;
      return true;
    }
  };

  return el;
}

/**
 * Creates a mock Document for testing.
 */
function createMockDocument(elements: any[]): any {
  const doc: any = {
    querySelector(selector: string) {
      // Match [data-prv-id="..."]
      const dataIdMatch = selector.match(/\[data-prv-id="([^"]+)"\]/);
      if (dataIdMatch) {
        const id = dataIdMatch[1];
        return elements.find(e => e.getAttribute('data-prv-id') === id) || null;
      }
      // Match #id
      if (selector.startsWith('#')) {
        const id = selector.substring(1);
        return elements.find(e => e.id === id) || null;
      }
      return elements.find(e => e.id === selector) || null;
    },
    getElementById(id: string) {
      return elements.find(e => e.id === id) || null;
    }
  };

  elements.forEach(e => {
    e.ownerDocument = doc;
  });

  return doc;
}

/**
 * Creates a mock Window for testing.
 */
function createMockWindow(): any {
  let scrolledX = 0;
  let scrolledY = 0;
  let navigatedUrl = '';

  return {
    getComputedStyle(_el: any) {
      return { display: 'block', visibility: 'visible', opacity: '1' };
    },
    scrollBy(options: { left?: number; top?: number }) {
      scrolledX += options.left || 0;
      scrolledY += options.top || 0;
    },
    location: {
      href: '',
      assign(url: string) {
        navigatedUrl = url;
      },
      getNavigatedUrl() {
        return navigatedUrl;
      }
    },
    getScrolled() {
      return { x: scrolledX, y: scrolledY };
    }
  };
}

async function run(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PRIVEDGE Phase 7: Local Action Guard & Execution');
  console.log('═══════════════════════════════════════════════════\n');

  // Setup mock DOM elements
  const btnContinue = createMockElement({ tagName: 'button', id: 'btn-continue', dataPrvId: 'prv-1' });
  const btnHidden = createMockElement({ tagName: 'button', id: 'btn-hidden', dataPrvId: 'prv-2', hidden: true });
  const btnDisabled = createMockElement({ tagName: 'button', id: 'btn-disabled', dataPrvId: 'prv-3', disabled: true });
  const inputSearch = createMockElement({ tagName: 'input', id: 'input-search', dataPrvId: 'prv-4', type: 'text' });
  const inputPassword = createMockElement({ tagName: 'input', id: 'input-pwd', dataPrvId: 'prv-5', type: 'password' });

  const doc = createMockDocument([btnContinue, btnHidden, btnDisabled, inputSearch, inputPassword]);
  const win = createMockWindow();

  // ─────────────────────────────────────────────────────────
  // A. CLICK CHECKS
  // ─────────────────────────────────────────────────────────
  await test('A1: valid visible target → APPROVE', () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'prv-1' },
      doc,
      win
    );
    assert.equal(decision.approved, true);
    assert.equal(decision.action.actionType, 'click');
    assert.equal(decision.action.targetElementId, 'prv-1');
  });

  await test('A2: missing target ID → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'click' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Missing target'));
  });

  await test('A3: hidden target → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'prv-2' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('hidden or not visible'));
  });

  await test('A4: disabled target → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'prv-3' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('disabled'));
  });

  await test('A5: stale target (disconnected or disappeared) → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'prv-disappeared-99' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('does not exist'));
  });

  await test('A6: unknown target ID → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'invented-id-123' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
  });

  // ─────────────────────────────────────────────────────────
  // B. SCROLL CHECKS
  // ─────────────────────────────────────────────────────────
  await test('B1: valid bounded scroll → APPROVE', () => {
    const decision = evaluateActionGuard(
      { action: 'scroll', scrollDelta: { x: 0, y: 350 } },
      doc,
      win
    );
    assert.equal(decision.approved, true);
    assert.equal(decision.action.actionType, 'scroll');
    assert.deepEqual(decision.action.scrollDelta, { x: 0, y: 350 });
  });

  await test('B2: excessive scroll delta (> 2000px) → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'scroll', scrollDelta: { x: 0, y: 50000 } },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Excessive scroll'));
  });

  await test('B3: malformed scroll value (NaN / missing) → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'scroll', scrollDelta: { x: NaN, y: 300 } },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('finite numbers'));
  });

  // ─────────────────────────────────────────────────────────
  // C. TYPE CHECKS
  // ─────────────────────────────────────────────────────────
  await test('C1: safe target with normal text → APPROVE', () => {
    const decision = evaluateActionGuard(
      { action: 'type', targetElementId: 'prv-4', text: 'quantum computing research' },
      doc,
      win
    );
    assert.equal(decision.approved, true);
    assert.equal(decision.action.actionType, 'type');
    assert.equal(decision.action.targetElementId, 'prv-4');
  });

  await test('C2: sensitive value (password/token/Aadhaar) → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'type', targetElementId: 'prv-4', text: 'my SecretPassword123' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Sensitive data pattern'));
  });

  await test('C3: target is password input field → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'type', targetElementId: 'prv-5', text: 'ordinarytext' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('password field'));
  });

  await test('C4: missing target for typing → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'type', text: 'query' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Missing target element ID'));
  });

  // ─────────────────────────────────────────────────────────
  // D. NAVIGATE CHECKS
  // ─────────────────────────────────────────────────────────
  await test('D1: valid https URL → APPROVE', () => {
    const decision = evaluateActionGuard(
      { action: 'navigate', url: 'https://isro.gov.in/missions' },
      doc,
      win
    );
    assert.equal(decision.approved, true);
    assert.equal(decision.action.actionType, 'navigate');
    assert.equal(decision.action.url, 'https://isro.gov.in/missions');
  });

  await test('D2: valid http URL → APPROVE', () => {
    const decision = evaluateActionGuard(
      { action: 'navigate', url: 'http://localhost:3000/dashboard' },
      doc,
      win
    );
    assert.equal(decision.approved, true);
  });

  await test('D3: javascript: URL → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'navigate', url: 'javascript:alert(document.cookie)' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Unsafe or malformed'));
  });

  await test('D4: data: URL → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'navigate', url: 'data:text/html,<script>alert(1)</script>' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Unsafe or malformed'));
  });

  await test('D5: malformed URL → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'navigate', url: 'not-a-valid-url-format' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
  });

  // ─────────────────────────────────────────────────────────
  // E. SECURITY CHECKS
  // ─────────────────────────────────────────────────────────
  await test('E1: malformed action structure → BLOCK', () => {
    const decision = evaluateActionGuard(null, doc, win);
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Malformed action'));
  });

  await test('E2: unsupported action type → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'eval_arbitrary_code', script: 'stealData()' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert(decision.reason.includes('Unsupported action'));
  });

  await test('E3: arbitrary JavaScript execution attempted → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'execute_js', code: 'window.alert(1)' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
  });

  await test('E4: missing required target for click → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'click', target: {} },
      doc,
      win
    );
    assert.equal(decision.approved, false);
  });

  await test('E5: failed guard check fails closed → BLOCK', () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'nonexistent-element' },
      doc,
      win
    );
    assert.equal(decision.approved, false);
    assert.equal(decision.guardChecks.some(c => !c.passed), true);
  });

  // ─────────────────────────────────────────────────────────
  // F. BROWSER EXECUTION CHECKS
  // ─────────────────────────────────────────────────────────
  await test('F1: approved action executes safely on DOM', async () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'prv-1' },
      doc,
      win
    );
    assert.equal(decision.approved, true);

    const execResult = await executeApprovedAction(decision, doc, win);
    assert.equal(execResult.success, true);
    assert.equal(execResult.actionType, 'click');
    assert.equal(execResult.targetElementId, 'prv-1');
    assert.equal(btnContinue.isClicked(), true);
  });

  await test('F2: blocked action is never executed', async () => {
    const decision = evaluateActionGuard(
      { action: 'click', targetElementId: 'prv-3' }, // disabled target
      doc,
      win
    );
    assert.equal(decision.approved, false);

    const execResult = await executeApprovedAction(decision, doc, win);
    assert.equal(execResult.success, false);
    assert.equal(btnDisabled.isClicked(), false);
    assert(execResult.error?.includes('Cannot execute'));
  });

  await test('F3: execution failure is reported honestly (stale target during execution)', async () => {
    // Create an initially approved decision
    const fakeDecision = {
      approved: true,
      action: { actionType: 'click' as const, targetElementId: 'prv-vanished' },
      reason: 'Approved beforehand',
      guardChecks: [],
    };

    const execResult = await executeApprovedAction(fakeDecision, doc, win);
    assert.equal(execResult.success, false);
    assert(execResult.error?.includes('Stale target'));
  });

  await test('F4: safe scroll execution works through DOM window APIs', async () => {
    const decision = evaluateActionGuard(
      { action: 'scroll', scrollDelta: { x: 0, y: 250 } },
      doc,
      win
    );
    assert.equal(decision.approved, true);

    const execResult = await executeApprovedAction(decision, doc, win);
    assert.equal(execResult.success, true);
    assert.equal(execResult.actionType, 'scroll');
    assert.deepEqual(win.getScrolled(), { x: 0, y: 250 });
  });

  await test('F5: safe type execution inserts text without logging sensitive payload', async () => {
    const decision = evaluateActionGuard(
      { action: 'type', targetElementId: 'prv-4', text: 'ISRO Chandrayaan' },
      doc,
      win
    );
    assert.equal(decision.approved, true);

    const execResult = await executeApprovedAction(decision, doc, win);
    assert.equal(execResult.success, true);
    assert.equal(inputSearch.value, 'ISRO Chandrayaan');
    // Result MUST NOT contain the typed text payload
    assert.equal('text' in execResult, false);
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error running action guard tests:', err);
  process.exit(1);
});
