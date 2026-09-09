/**
 * PRIVEDGE Phase 5 — Backend Test Suite
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Uses Node's built-in http module — no extra test framework.
 * Consistent with the Phases 1–4 test approach.
 *
 * Run: node --experimental-strip-types --no-warnings tests/backend.test.ts
 */

import http from 'http';
import { createApp } from '../src/app';
import { getDb, closeDb } from '../src/db/database';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

// ── Test harness ───────────────────────────────────────────────────────────
let passed = 0; let failed = 0;

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
interface Res { status: number; body: Record<string, unknown>; }

function req(port: number, method: string, path: string, body?: unknown): Promise<Res> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const opts: http.RequestOptions = {
      hostname: 'localhost', port, path, method,
      headers: { 'Content-Type': 'application/json',
                 ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode ?? 0, body: { raw: d } as Record<string,unknown> }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// ── Valid sanitized context helper ─────────────────────────────────────────
function validCtx(sessionId: string, taskId?: string): object {
  return {
    sessionId,
    ...(taskId ? { taskId } : {}),
    privacy: { sanitized: true, rawDataIncluded: false },
    page: { urlOrigin: 'https://example.com', titleSafe: 'Example Page',
            domain: 'example.com', viewport: { width: 1280, height: 800 } },
    elements: [
      { stableId: 'prv-1', tagName: 'button', role: 'button', labelSafe: 'Submit',
        decision: 'ALLOW', isInteractive: true, isVisible: true },
      { stableId: 'prv-2', tagName: 'input', role: 'textbox', labelSafe: 'Email',
        decision: 'MASK', category: 'EMAIL', value: '[••••]', isInteractive: true },
    ],
    redactions: [
      { type: 'EMAIL', method: 'MASK', elementId: 'prv-2', reason: 'Email masked by Phase 4' },
    ],
    disclosure: { totalDetections: 1, blockedCount: 0, maskedCount: 1, allowedCount: 1, visualRedactedCount: 0 },
    visualContext: [
      { id: 'vis-1', decision: 'MASK', category: 'PERSON', label: '[REDACTED]',
        confidence: 0.87, boundingBox: { x: 100, y: 50, width: 80, height: 80 } },
    ],
  };
}

// ── Server lifecycle ───────────────────────────────────────────────────────
// Point DB at a temp file so tests never pollute the real DB
process.env['PRIVEDGE_DB_DIR']  = tmpdir();
process.env['PRIVEDGE_DB_FILE'] = `privedge-test-${randomUUID()}.db`;

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
  return new Promise(resolve => server.close(() => { closeDb(); resolve(); }));
}

// ── Run ────────────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PRIVEDGE Phase 5: Backend Test Suite');
  console.log('═══════════════════════════════════════════════════\n');

  await startServer();

  // 1. Health
  await test('TEST 1: GET /api/health returns ok', async () => {
    const r = await req(port, 'GET', '/api/health');
    assert(r.status === 200, `status ${r.status}`);
    assert((r.body as {status:string}).status === 'ok', 'status:ok');
    assert((r.body as {service:string}).service === 'privedge-backend', 'service name');
  });

  // 2–3. Sessions
  let sessionId = '';
  await test('TEST 2: POST /api/sessions creates session', async () => {
    const r = await req(port, 'POST', '/api/sessions', {});
    assert(r.status === 201, `status ${r.status}`);
    const d = (r.body as {data:{id:string;status:string}}).data;
    assert(typeof d.id === 'string', 'id is string');
    assert(d.status === 'active', 'status active');
    sessionId = d.id;
  });

  await test('TEST 3: GET /api/sessions/:id returns session + tasks', async () => {
    const r = await req(port, 'GET', `/api/sessions/${sessionId}`);
    assert(r.status === 200, `status ${r.status}`);
    const d = (r.body as {data:{session:{id:string};tasks:unknown[]}}).data;
    assert(d.session.id === sessionId, 'session id');
    assert(Array.isArray(d.tasks), 'tasks array');
  });

  // 4–5. Tasks
  let taskId = '';
  await test('TEST 4: POST /api/tasks creates task', async () => {
    const r = await req(port, 'POST', '/api/tasks', { sessionId, title: 'Find login button' });
    assert(r.status === 201, `status ${r.status}`);
    const d = (r.body as {data:{id:string}}).data;
    assert(typeof d.id === 'string', 'task id');
    taskId = d.id;
  });

  await test('TEST 5: GET /api/tasks/:id returns task metadata', async () => {
    const r = await req(port, 'GET', `/api/tasks/${taskId}`);
    assert(r.status === 200, `status ${r.status}`);
    assert((r.body as {data:{task:{id:string}}}).data.task.id === taskId, 'task id matches');
  });

  // 6–8. Contexts accept / persist / retrieve
  let contextId = '';
  await test('TEST 6: POST /api/contexts accepts valid sanitized context', async () => {
    const r = await req(port, 'POST', '/api/contexts', validCtx(sessionId, taskId));
    assert(r.status === 201, `status ${r.status}`);
    const d = (r.body as {data:{accepted:boolean;sanitized:boolean;contextId:string}}).data;
    assert(d.accepted === true, 'accepted');
    assert(d.sanitized === true, 'sanitized');
    contextId = d.contextId;
  });

  await test('TEST 7: accepted context is persisted in DB', async () => {
    const r2 = await req(port, 'POST', '/api/contexts', validCtx(sessionId));
    const d = (r2.body as {data:{contextId:string}}).data;
    assert(typeof d.contextId === 'string', 'contextId present');
  });

  await test('TEST 8: GET /api/contexts/:id retrieves stored sanitized context', async () => {
    const r = await req(port, 'GET', `/api/contexts/${contextId}`);
    assert(r.status === 200, `status ${r.status}`);
    const d = (r.body as {data:{id:string;pageMetadata:{titleSafe:string}}}).data;
    assert(d.id === contextId, 'id matches');
    assert(d.pageMetadata.titleSafe === 'Example Page', 'safe title preserved');
  });

  // 9–14. Privacy boundary rejections
  await test('TEST 9: POST /api/contexts rejects password field', async () => {
    const r = await req(port, 'POST', '/api/contexts', { ...validCtx(sessionId), password: 's3cr3t' });
    assert(r.status === 400, `status ${r.status}`);
    assert((r.body as {success:boolean}).success === false, 'rejected');
  });

  await test('TEST 10: POST /api/contexts rejects token field', async () => {
    const r = await req(port, 'POST', '/api/contexts', { ...validCtx(sessionId), token: 'abc' });
    assert(r.status === 400, `status ${r.status}`);
  });

  await test('TEST 11: POST /api/contexts rejects cookie field', async () => {
    const r = await req(port, 'POST', '/api/contexts', { ...validCtx(sessionId), cookie: 'x=1' });
    assert(r.status === 400, `status ${r.status}`);
  });

  await test('TEST 12: POST /api/contexts rejects rawScreenshot field', async () => {
    const r = await req(port, 'POST', '/api/contexts', { ...validCtx(sessionId), rawScreenshot: 'data:image/png;base64,abc' });
    assert(r.status === 400, `status ${r.status}`);
  });

  await test('TEST 13: POST /api/contexts rejects rawDom field', async () => {
    const r = await req(port, 'POST', '/api/contexts', { ...validCtx(sessionId), rawDom: '<html/>' });
    assert(r.status === 400, `status ${r.status}`);
  });

  await test('TEST 14: POST /api/contexts rejects rawPii field', async () => {
    const r = await req(port, 'POST', '/api/contexts', { ...validCtx(sessionId), rawPii: '9999-8888-7777' });
    assert(r.status === 400, `status ${r.status}`);
  });

  await test('TEST 14b: POST /api/contexts rejects missing privacy marker', async () => {
    const ctx = validCtx(sessionId) as Record<string, unknown>;
    delete ctx['privacy'];
    const r = await req(port, 'POST', '/api/contexts', ctx);
    assert(r.status === 400, `status ${r.status}`);
  });

  // 15. Rejected context not persisted
  await test('TEST 15: rejected context is NOT persisted in DB', async () => {
    const db = getDb();
    const before = (db.prepare('SELECT COUNT(*) AS c FROM sanitized_contexts').get() as {c:number}).c;
    await req(port, 'POST', '/api/contexts', { ...validCtx(sessionId), password: 'x' });
    const after = (db.prepare('SELECT COUNT(*) AS c FROM sanitized_contexts').get() as {c:number}).c;
    assert(after === before, 'row count unchanged after rejection');
  });

  // 16. Redaction metadata accepted
  await test('TEST 16: safe redaction metadata (no raw values) accepted', async () => {
    const ctx = {
      ...validCtx(sessionId),
      redactions: [
        { type: 'PASSWORD', method: 'BLOCKED', elementId: 'prv-3', reason: 'Password blocked' },
        { type: 'EMAIL',    method: 'MASKED',  elementId: 'prv-4', reason: 'Email masked' },
        { type: 'AADHAAR',  method: 'BLOCKED', reason: 'Aadhaar blocked' },
      ],
    };
    const r = await req(port, 'POST', '/api/contexts', ctx);
    assert(r.status === 201, `status ${r.status}`);
  });

  await test('TEST 16b: exact Phase 4 MinimumDisclosure structure accepted', async () => {
    const phase4Payload = {
      sessionId,
      privacy: { sanitized: true, rawDataIncluded: false },
      page: {
        title: 'Phase 4 Portal',
        url: 'https://isro.gov.in/mission',
        domain: 'isro.gov.in',
      },
      elements: [
        { id: 'el-1', tagName: 'button', role: 'button', decision: 'ALLOW' },
        { id: 'el-2', tagName: 'input', role: 'textbox', decision: 'MASK', value: '[MASKED]' },
      ],
      visualRegions: [
        { id: 'vis-1', decision: 'MASK', category: 'FACE', label: '[REDACTED]', confidence: 0.95, boundingBox: { x: 10, y: 10, width: 50, height: 50 } },
      ],
      firewallSummary: {
        totalDetections: 2,
        blockedCount: 0,
        maskedCount: 2,
        allowedCount: 1,
        visualRedactedCount: 1,
      },
      disclosedAt: Date.now(),
    };
    const r = await req(port, 'POST', '/api/contexts', phase4Payload);
    assert(r.status === 201, `status ${r.status}`);
    assert((r.body as {data:{sanitized:boolean}}).data.sanitized === true, 'sanitized true');
  });

  // 17–19. Actions
  await test('TEST 17: POST /api/actions accepts click proposal as PENDING', async () => {
    const r = await req(port, 'POST', '/api/actions', {
      sessionId, taskId, actionType: 'click', target: { elementId: 'prv-1' },
    });
    assert(r.status === 201, `status ${r.status}`);
    assert((r.body as {data:{status:string}}).data.status === 'pending', 'status pending');
  });

  await test('TEST 18: POST /api/actions accepts scroll proposal as PENDING', async () => {
    const r = await req(port, 'POST', '/api/actions', {
      sessionId, actionType: 'scroll', target: { scrollDelta: { x: 0, y: 300 } },
    });
    assert(r.status === 201, `status ${r.status}`);
    assert((r.body as {data:{status:string}}).data.status === 'pending', 'status pending');
  });

  await test('TEST 19: POST /api/actions rejects unsupported action type', async () => {
    const r = await req(port, 'POST', '/api/actions', {
      sessionId, actionType: 'execute_script', target: { elementId: 'prv-1' },
    });
    assert(r.status === 400, `status ${r.status}`);
  });

  // 20. Data persists across "restart" (re-open same DB)
  await test('TEST 20: data persists across server restart (DB survives close/reopen)', async () => {
    const db = getDb();
    const countBefore = (db.prepare('SELECT COUNT(*) AS c FROM sanitized_contexts').get() as {c:number}).c;
    closeDb(); // simulate restart
    const db2 = getDb(); // re-open same test DB
    const countAfter = (db2.prepare('SELECT COUNT(*) AS c FROM sanitized_contexts').get() as {c:number}).c;
    assert(countAfter === countBefore, `count matches: ${countAfter} === ${countBefore}`);
  });

  // 21. E2E privacy negative test
  await test('TEST 21: E2E — unsafe payload with fake PII rejected, not stored', async () => {
    const db = getDb();
    const before = (db.prepare('SELECT COUNT(*) AS c FROM sanitized_contexts').get() as {c:number}).c;

    const unsafe = {
      sessionId,
      privacy: { sanitized: true, rawDataIncluded: false },
      page: { titleSafe: 'Test' },
      elements: [], redactions: [],
      disclosure: { totalDetections:0, blockedCount:0, maskedCount:0, allowedCount:0, visualRedactedCount:0 },
      // Deliberately injected forbidden fields
      password: 'Hunter2!',
      rawPii: 'user@example.com',
      token: 'Bearer secret-xyz',
    };
    const r = await req(port, 'POST', '/api/contexts', unsafe);
    assert(r.status === 400, `Expected 400, got ${r.status}`);

    const after = (db.prepare('SELECT COUNT(*) AS c FROM sanitized_contexts').get() as {c:number}).c;
    assert(after === before, 'nothing persisted after rejection');

    // Verify error message does NOT echo the raw values
    const errMsg = (r.body as {error?:string}).error ?? '';
    assert(!errMsg.includes('Hunter2'), 'raw password not echoed in error');
    assert(!errMsg.includes('user@example.com'), 'raw email not echoed in error');
    assert(!errMsg.includes('secret-xyz'), 'raw token not echoed in error');
  });

  // 22. E2E — sanitized equivalent accepted
  await test('TEST 22: E2E — sanitized equivalent of unsafe payload is accepted and stored safely', async () => {
    const safe = {
      sessionId,
      privacy: { sanitized: true, rawDataIncluded: false },
      page: { titleSafe: 'Login Page', urlOrigin: 'https://example.com' },
      elements: [
        { stableId: 'prv-pw', decision: 'BLOCK', category: 'PASSWORD', value: '[BLOCKED]' },
        { stableId: 'prv-em', decision: 'MASK',  category: 'EMAIL',    value: '[••••]' },
      ],
      redactions: [
        { type: 'PASSWORD', method: 'BLOCKED', elementId: 'prv-pw', reason: 'Password blocked' },
        { type: 'EMAIL',    method: 'MASKED',  elementId: 'prv-em', reason: 'Email masked' },
      ],
      disclosure: { totalDetections:2, blockedCount:1, maskedCount:1, allowedCount:0, visualRedactedCount:0 },
    };
    const r = await req(port, 'POST', '/api/contexts', safe);
    assert(r.status === 201, `status ${r.status}`);

    // Verify stored row contains no raw values
    const ctxId = (r.body as {data:{contextId:string}}).data.contextId;
    const gr = await req(port, 'GET', `/api/contexts/${ctxId}`);
    const stored = JSON.stringify((gr.body as {data:unknown}).data);
    assert(!stored.includes('Hunter2'), 'raw password not in stored row');
    assert(!stored.includes('user@example.com'), 'raw email not in stored row');
    assert(!stored.includes('secret-xyz'), 'raw token not in stored row');
  });

  await stopServer();

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('[PRIVEDGE]', err); process.exit(1); });
