/**
 * PRIVEDGE Phase 6 — Cloud Reasoning Test Suite
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Deterministic testing with in-memory MockReasoningProvider.
 * Verifies privacy boundaries, structured reasoning output, grounding validation,
 * safe failure states, and PENDING action persistence.
 *
 * Run: node --experimental-strip-types --no-warnings tests/reasoning.test.ts
 */

import http from 'http';
import { createApp } from '../src/app';
import { getDb, closeDb } from '../src/db/database';
import { setReasoningProvider, resetReasoningProvider } from '../src/reasoning/client';
import { MockReasoningProvider } from '../src/reasoning/provider';
import type { SafeReasoningContext } from '../src/types/reasoning';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';

// ── Test harness ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// ── HTTP helper ────────────────────────────────────────────────────────────
interface Res {
  status: number;
  body: Record<string, unknown>;
}

function req(port: number, method: string, path: string, body?: unknown): Promise<Res> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const opts: http.RequestOptions = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => {
        d += c;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: { raw: d } as Record<string, unknown> });
        }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// ── Helper to build sanitized context for DB insertion ─────────────────────
function validSanitizedCtx(sessionId: string, taskId?: string) {
  return {
    sessionId,
    ...(taskId ? { taskId } : {}),
    privacy: { sanitized: true, rawDataIncluded: false },
    page: {
      urlOrigin: 'https://app.privedge.internal',
      titleSafe: 'Secure Dashboard',
      domain: 'privedge.internal',
      viewport: { width: 1280, height: 800 },
    },
    elements: [
      {
        stableId: 'btn-continue',
        tagName: 'button',
        role: 'button',
        labelSafe: 'Continue',
        decision: 'ALLOW',
        isInteractive: true,
        isVisible: true,
      },
      {
        stableId: 'input-search',
        tagName: 'input',
        role: 'textbox',
        labelSafe: 'Search',
        decision: 'ALLOW',
        isInteractive: true,
        isVisible: true,
      },
      {
        stableId: 'input-ssn',
        tagName: 'input',
        role: 'textbox',
        labelSafe: 'SSN Field',
        decision: 'MASK',
        category: 'UNKNOWN_SENSITIVE',
        value: '[••••]',
        isInteractive: true,
        isVisible: true,
      },
    ],
    redactions: [
      { type: 'UNKNOWN_SENSITIVE', method: 'MASK', elementId: 'input-ssn', reason: 'Masked by firewall' },
    ],
    disclosure: {
      totalDetections: 1,
      blockedCount: 0,
      maskedCount: 1,
      allowedCount: 2,
      visualRedactedCount: 0,
    },
    visualContext: [
      {
        id: 'vis-header',
        decision: 'ALLOW',
        label: 'header-banner',
        confidence: 0.95,
        boundingBox: { x: 0, y: 0, width: 1280, height: 60 },
      },
    ],
  };
}

// ── Server setup ───────────────────────────────────────────────────────────
process.env['PRIVEDGE_DB_DIR'] = tmpdir();
process.env['PRIVEDGE_DB_FILE'] = `privedge-reasoning-test-${randomUUID()}.db`;

const app = createApp();
let server: http.Server;
let port: number;

function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = app.listen(0, () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise(resolve =>
    server.close(() => {
      closeDb();
      resetReasoningProvider();
      resolve();
    })
  );
}

// ── Run Tests ──────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PRIVEDGE Phase 6: Cloud Reasoning Test Suite');
  console.log('═══════════════════════════════════════════════════\n');

  await startServer();

  let receivedContexts: SafeReasoningContext[] = [];
  const mockProvider = new MockReasoningProvider(ctx => {
    receivedContexts.push(ctx);
    return JSON.stringify({
      action: 'click',
      targetElementId: 'btn-continue',
      reason: 'Click the continue button to proceed.',
      confidence: 0.95,
    });
  });
  setReasoningProvider(mockProvider);

  // Setup: create real session and task in DB
  const sessRes = await req(port, 'POST', '/api/sessions', {});
  assert(sessRes.status === 201, 'session setup failed');
  const sessionId = (sessRes.body as { data: { id: string } }).data.id;

  const taskRes = await req(port, 'POST', '/api/tasks', { sessionId, title: 'Proceed through onboarding' });
  assert(taskRes.status === 201, 'task setup failed');
  const taskId = (taskRes.body as { data: { id: string } }).data.id;

  // 1. Missing session rejected
  await test('TEST 1: missing session rejected', async () => {
    const r = await req(port, 'POST', '/api/reason', {
      sessionId: '00000000-0000-0000-0000-000000000000',
      userGoal: 'Click continue',
    });
    assert(r.status === 404, `expected 404, got ${r.status}`);
    assert(r.body['error'] === 'Session not found.', 'error message');
  });

  // 2. Missing task rejected
  await test('TEST 2: missing task rejected', async () => {
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId: '00000000-0000-0000-0000-000000000000',
      userGoal: 'Click continue',
    });
    assert(r.status === 404, `expected 404, got ${r.status}`);
    assert(r.body['error'] === 'Task not found.', 'error message');
  });

  // 3. Missing context rejected
  await test('TEST 3: missing context rejected when no context has been uploaded', async () => {
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Click continue',
    });
    assert(r.status === 404, `expected 404, got ${r.status}`);
    assert(r.body['error'] === 'Sanitized context not found for session.', 'error message');
  });

  // Now upload valid sanitized context
  const ctxUpload = await req(port, 'POST', '/api/contexts', validSanitizedCtx(sessionId, taskId));
  assert(ctxUpload.status === 201, 'context upload failed');

  // 4. Sanitized context accepted and used for reasoning
  await test('TEST 4: sanitized context accepted and reasoning succeeds', async () => {
    receivedContexts = [];
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Click continue',
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.body['success'] === true, 'success true');
    const data = r.body['data'] as { proposal: { action: string; targetElementId: string } };
    assert(data.proposal.action === 'click', 'proposal action click');
    assert(data.proposal.targetElementId === 'btn-continue', 'proposal target');
    assert(receivedContexts.length === 1, 'provider called once');
  });

  // 5. Raw PII never passed to provider
  await test('TEST 5: raw PII never passed to provider', async () => {
    assert(receivedContexts.length > 0, 'receivedContexts present');
    const ctx = receivedContexts[0];
    const ctxString = JSON.stringify(ctx).toLowerCase();
    assert(!ctxString.includes('aadhaar'), 'no aadhaar');
    assert(!ctxString.includes('pan:'), 'no pan');
    assert(!ctxString.includes('password'), 'no password');
    assert(!ctxString.includes('secret'), 'no secret');
    // Ensure masked element only contains masked placeholder
    const maskedEl = ctx.elements.find(e => e.decision === 'MASK');
    assert(maskedEl !== undefined, 'masked element exists');
    if (maskedEl) {
      assert(!('value' in (maskedEl as unknown as object)), 'raw value property omitted from safe element');
    }
  });

  // 6. Raw screenshot never passed to provider
  await test('TEST 6: raw screenshot never passed to provider', async () => {
    const ctxString = JSON.stringify(receivedContexts[0]).toLowerCase();
    assert(!ctxString.includes('rawscreenshot'), 'no rawscreenshot');
    assert(!ctxString.includes('screenshot'), 'no screenshot');
    assert(!ctxString.includes('data:image'), 'no base64 image data');
  });

  // 7. Raw DOM never passed to provider
  await test('TEST 7: raw DOM never passed to provider', async () => {
    const ctxString = JSON.stringify(receivedContexts[0]).toLowerCase();
    assert(!ctxString.includes('rawdom'), 'no rawdom');
    assert(!ctxString.includes('rawhtml'), 'no rawhtml');
    assert(!ctxString.includes('<html>'), 'no raw html tag');
  });

  // 8. FirewallInput never passed to provider
  await test('TEST 8: FirewallInput never passed to provider', async () => {
    const ctx = receivedContexts[0] as unknown as Record<string, unknown>;
    assert(!('sanitizedContext' in ctx), 'no nested sanitizedContext object');
    assert(!('visualDetections' in ctx), 'no raw visualDetections');
    assert(!('imageWidth' in ctx), 'no raw image dimensions');
    assert(!('imageHeight' in ctx), 'no raw image dimensions');
  });

  // 9. Model structured response parsed correctly
  await test('TEST 9: model structured response parsed correctly', async () => {
    mockProvider.setHandler(() => `\`\`\`json
{
  "action": "click",
  "targetElementId": "input-search",
  "reason": "Focus the search input to query products.",
  "confidence": 0.92
}
\`\`\``);

    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Search for items',
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const data = r.body['data'] as { proposal: { action: string; targetElementId: string; confidence: number } };
    assert(data.proposal.action === 'click', 'action click');
    assert(data.proposal.targetElementId === 'input-search', 'target input-search');
    assert(data.proposal.confidence === 0.92, 'confidence parsed');
  });

  // 10. Invalid model JSON rejected
  await test('TEST 10: invalid model JSON rejected', async () => {
    mockProvider.setHandler(() => 'Not a valid JSON response');
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Do something',
    });
    assert(r.status === 400, `expected 400, got ${r.status}`);
    assert(r.body['success'] === false, 'success false');
    assert((r.body['error'] as string).includes('Invalid JSON'), 'error is invalid json');
  });

  // 11. Unsupported action rejected
  await test('TEST 11: unsupported action rejected', async () => {
    mockProvider.setHandler(() => JSON.stringify({
      action: 'execute_script',
      targetElementId: 'btn-continue',
      reason: 'Malicious action',
      confidence: 1.0,
    }));
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Run script',
    });
    assert(r.status === 400, `expected 400, got ${r.status}`);
    assert(r.body['success'] === false, 'success false');
    assert((r.body['error'] as string).includes('Unsupported action'), 'error contains unsupported action');
  });

  // 12. Nonexistent target rejected when target validation applies
  await test('TEST 12: nonexistent target rejected', async () => {
    mockProvider.setHandler(() => JSON.stringify({
      action: 'click',
      targetElementId: 'prv-hallucinated-999',
      reason: 'Invented element',
      confidence: 0.99,
    }));
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Click invented element',
    });
    assert(r.status === 400, `expected 400, got ${r.status}`);
    assert(r.body['success'] === false, 'success false');
    assert((r.body['error'] as string).includes('not present in the sanitized context'), 'grounding error');
  });

  // 13. Valid click proposal accepted
  await test('TEST 13: valid click proposal accepted', async () => {
    mockProvider.setHandler(() => JSON.stringify({
      action: 'click',
      targetElementId: 'btn-continue',
      reason: 'Proceed to next view',
      confidence: 0.96,
    }));
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Click Continue',
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const data = r.body['data'] as { proposal: { action: string; targetElementId: string }; stored: boolean };
    assert(data.proposal.action === 'click', 'action click');
    assert(data.proposal.targetElementId === 'btn-continue', 'target btn-continue');
    assert(data.stored === true, 'stored true');
  });

  // 14. Valid scroll proposal accepted
  await test('TEST 14: valid scroll proposal accepted', async () => {
    mockProvider.setHandler(() => JSON.stringify({
      action: 'scroll',
      scrollDelta: { x: 0, y: 450 },
      reason: 'Scroll down to reveal more items',
      confidence: 0.88,
    }));
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Scroll down',
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const data = r.body['data'] as { proposal: { action: string; scrollDelta: { x: number; y: number } }; stored: boolean };
    assert(data.proposal.action === 'scroll', 'action scroll');
    assert(data.proposal.scrollDelta.y === 450, 'scrollDelta y 450');
    assert(data.stored === true, 'stored true');
  });

  // 15. Action stored as PENDING (never executed)
  await test('TEST 15: action stored as PENDING in SQLite', async () => {
    mockProvider.setHandler(() => JSON.stringify({
      action: 'click',
      targetElementId: 'btn-continue',
      reason: 'Click continue',
      confidence: 0.9,
    }));
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Click continue button',
    });
    assert(r.status === 200, 'success 200');
    const actionId = (r.body['data'] as { actionId: string }).actionId;
    assert(typeof actionId === 'string', 'actionId returned');

    // Query DB directly
    const row = getDb().prepare('SELECT * FROM actions WHERE id=?').get(actionId) as { status: string; action_type: string };
    assert(row !== undefined, 'action row found in DB');
    assert(row.status === 'pending', `status must be pending, was: ${row.status}`);
    assert(row.action_type === 'click', 'action_type click');
  });

  // 16. Provider failure handled safely
  await test('TEST 16: provider failure handled safely', async () => {
    mockProvider.setHandler(() => new Error('Cloud API timeout 504'));
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Click button',
    });
    assert(r.status === 503, `expected 503, got ${r.status}`);
    assert(r.body['success'] === false, 'success false');
    assert((r.body['error'] as string).includes('Cloud API timeout 504'), 'contains error message');
  });

  // 17. Missing API configuration handled safely
  await test('TEST 17: missing API configuration handled safely without fake success', async () => {
    mockProvider.setConfigured(false);
    const r = await req(port, 'POST', '/api/reason', {
      sessionId,
      taskId,
      userGoal: 'Click button',
    });
    assert(r.status === 503, `expected 503, got ${r.status}`);
    assert(r.body['success'] === false, 'success false');
    assert((r.body['error'] as string).includes('MODEL_API_KEY is missing'), 'clear configuration error');
    // Reinstate configuration for subsequent test
    mockProvider.setConfigured(true);
  });

  // 18. PRIVACY TEST - CRITICAL: Unsafe context containing forbidden keys is blocked
  await test('TEST 18: [CRITICAL PRIVACY] unsafe context blocked before provider invocation', async () => {
    let providerCalled = false;
    mockProvider.setHandler(() => {
      providerCalled = true;
      return JSON.stringify({ action: 'none', reason: 'Safe fallback', confidence: 0 });
    });

    const unsafePayload = {
      sessionId,
      taskId,
      privacy: { sanitized: true, rawDataIncluded: false },
      page: { urlOrigin: 'https://example.com', titleSafe: 'Title' },
      elements: [{ stableId: 'e1', tagName: 'div', decision: 'ALLOW' }],
      disclosure: { totalDetections: 0, blockedCount: 0, maskedCount: 0, allowedCount: 1, visualRedactedCount: 0 },
      password: 'SuperSecretPassword123!',
      token: 'jwt.token.abc',
      cookie: 'session=xyz',
      rawScreenshot: 'data:image/png;base64,AAAA',
      rawDom: '<div>sensitive data</div>',
      rawPii: { name: 'John Doe' },
      originalValue: 'secret-field-value',
    };

    // Attempt to inject unsafe payload into contexts
    const r = await req(port, 'POST', '/api/contexts', unsafePayload);
    assert(r.status === 400, `expected 400 rejection, got ${r.status}`);
    assert(r.body['success'] === false, 'payload rejected');
    assert(!providerCalled, 'provider was NEVER called with unsafe data');
  });

  await stopServer();

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal error running reasoning tests:', err);
  process.exit(1);
});
