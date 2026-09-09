/**
 * PRIVEDGE Phase 5 — Contexts Route
 * POST /api/contexts  — accept sanitized Phase 4 output
 * GET  /api/contexts/:id — return stored sanitized context
 *
 * Privacy pipeline on every POST:
 *   body → forbidden-key scan → privacy marker check
 *   → structural validation → safe column extraction
 *   → parameterized DB insert → safe response
 *
 * The body is NEVER logged. Raw values are NEVER stored.
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { dbRun, dbGet } from '../db/database';
import { validateSanitizedContext, adaptInboundPayload, buildRedactionSummary } from '../validation/sanitizedContext';
import type { InboundSanitizedContext, ContextRow } from '../types/api';

export const contextsRouter: Router = Router();

// POST /api/contexts
contextsRouter.post('/', (req, res) => {
  // 1. Privacy validation — fail closed
  const result = validateSanitizedContext(req.body as unknown);
  if (!result.valid) {
    res.status(400).json({ success: false, error: `Validation failed: ${result.errors.join('; ')}` });
    return;
  }

  const ctx = adaptInboundPayload(req.body as Record<string, unknown>) as unknown as InboundSanitizedContext;

  // 2. Session must exist
  if (!dbGet('SELECT id FROM sessions WHERE id=?', [ctx.sessionId])) {
    res.status(404).json({ success: false, error: 'Session not found.' }); return;
  }

  // 3. Task must exist if provided
  if (ctx.taskId && !dbGet('SELECT id FROM tasks WHERE id=?', [ctx.taskId])) {
    res.status(404).json({ success: false, error: 'Task not found.' }); return;
  }

  const id = randomUUID();
  const now = Date.now();

  // 4. Extract ONLY safe columns — defence-in-depth stripping
  const pageMetadata = JSON.stringify({
    url: ctx.page.url ?? ctx.page.urlOrigin,
    urlOrigin: ctx.page.urlOrigin ?? ctx.page.url,
    title: ctx.page.title ?? ctx.page.titleSafe,
    titleSafe: ctx.page.titleSafe ?? ctx.page.title,
    domain: ctx.page.domain,
    viewport: ctx.page.viewport,
  });

  const structure = JSON.stringify(
    (ctx.elements ?? []).map(el => ({
      id: el.id ?? el.stableId,
      tagName: el.tagName,
      type: el.type,
      role: el.role,
      label: el.label ?? el.labelSafe,
      labelSafe: el.labelSafe ?? el.label,
      ariaLabel: el.ariaLabel,
      decision: el.decision,
      category: el.category,
      isInteractive: el.isInteractive,
      isVisible: el.isVisible,
      boundingBox: el.boundingBox,
      // Only keep value if it's a redaction placeholder (starts with [ or contains •)
      value: typeof el.value === 'string' &&
             (el.value.startsWith('[') || el.value.includes('•'))
               ? el.value : undefined,
    }))
  );

  const redactionSummary    = JSON.stringify(buildRedactionSummary(ctx));
  const summary             = ctx.firewallSummary ?? ctx.disclosure;
  const disclosureMetadata  = JSON.stringify(summary);
  const regions             = ctx.visualRegions ?? ctx.visualContext;
  const visualContext       = regions
    ? JSON.stringify(regions.map(v => ({
        id: v.id, decision: v.decision, category: v.category,
        label: v.label, confidence: v.confidence, boundingBox: v.boundingBox,
      })))
    : null;

  // 5. Parameterized insert
  dbRun(
    `INSERT INTO sanitized_contexts
       (id,session_id,task_id,page_metadata,structure,redaction_summary,
        disclosure_metadata,sanitized_visual_context,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, ctx.sessionId, ctx.taskId ?? null, pageMetadata, structure,
     redactionSummary, disclosureMetadata, visualContext, now]
  );

  // 6. Safe response — no echo of input
  res.status(201).json({
    success: true,
    data: { accepted: true, sanitized: true, contextId: id, sessionId: ctx.sessionId, taskId: ctx.taskId },
  });
});

// GET /api/contexts/:id
contextsRouter.get('/:id', (req, res) => {
  const row = dbGet<ContextRow>('SELECT * FROM sanitized_contexts WHERE id=?', [req.params['id']]);
  if (!row) { res.status(404).json({ success: false, error: 'Context not found.' }); return; }
  res.json({
    success: true,
    data: {
      id: row.id,
      sessionId: row.session_id,
      taskId: row.task_id ?? undefined,
      pageMetadata:         JSON.parse(row.page_metadata),
      structure:            JSON.parse(row.structure),
      redactionSummary:     JSON.parse(row.redaction_summary),
      disclosureMetadata:   JSON.parse(row.disclosure_metadata),
      sanitizedVisualContext: row.sanitized_visual_context
        ? JSON.parse(row.sanitized_visual_context) : null,
      createdAt: row.created_at,
    },
  });
});
