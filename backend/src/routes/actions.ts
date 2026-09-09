/**
 * PRIVEDGE Phase 5 — Actions Route
 * POST /api/actions — validate and store action PROPOSAL as PENDING.
 *
 * DOES NOT execute actions. Phase 7 handles execution.
 * Supported types: click | scroll | navigate
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { dbRun, dbGet } from '../db/database';
import type { ActionProposal, ActionType, ActionRow } from '../types/api';

const SUPPORTED: readonly ActionType[] = ['click', 'scroll', 'navigate'];

export const actionsRouter: Router = Router();

actionsRouter.post('/', (req, res) => {
  const body = req.body as Partial<ActionProposal>;

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    res.status(400).json({ success: false, error: 'sessionId required.' }); return;
  }
  if (!SUPPORTED.includes(body.actionType as ActionType)) {
    res.status(400).json({ success: false,
      error: `actionType must be one of: ${SUPPORTED.join(', ')}.` }); return;
  }
  if (!body.target || typeof body.target !== 'object') {
    res.status(400).json({ success: false, error: 'target required.' }); return;
  }
  if (!dbGet('SELECT id FROM sessions WHERE id=?', [body.sessionId])) {
    res.status(404).json({ success: false, error: 'Session not found.' }); return;
  }
  if (body.taskId && !dbGet('SELECT id FROM tasks WHERE id=?', [body.taskId])) {
    res.status(404).json({ success: false, error: 'Task not found.' }); return;
  }

  // Safe target — strip auth params from URLs
  const safeTarget = JSON.stringify({
    elementId:   typeof body.target.elementId === 'string' ? body.target.elementId : undefined,
    coordinates: body.target.coordinates,
    scrollDelta: body.target.scrollDelta,
    url: body.actionType === 'navigate' && typeof body.target.url === 'string'
      ? stripAuth(body.target.url) : undefined,
  });

  const id = randomUUID(); const now = Date.now();
  dbRun('INSERT INTO actions (id,session_id,task_id,action_type,target,status,created_at) VALUES (?,?,?,?,?,?,?)',
    [id, body.sessionId, body.taskId ?? null, body.actionType, safeTarget, 'pending', now]);

  const row = dbGet<ActionRow>('SELECT * FROM actions WHERE id=?', [id])!;
  res.status(201).json({ success: true, data: {
    actionId: row.id, sessionId: row.session_id, taskId: row.task_id ?? undefined,
    actionType: row.action_type, status: row.status, createdAt: row.created_at,
  }});
});

// GET /api/actions/:id
actionsRouter.get('/:id', (req, res) => {
  const row = dbGet<ActionRow>('SELECT * FROM actions WHERE id=?', [req.params['id']]);
  if (!row) {
    res.status(404).json({ success: false, error: 'Action not found.' });
    return;
  }
  let targetObj: unknown = {};
  try { targetObj = JSON.parse(row.target); } catch {}
  res.json({
    success: true,
    data: {
      actionId: row.id,
      sessionId: row.session_id,
      taskId: row.task_id ?? undefined,
      actionType: row.action_type,
      target: targetObj,
      status: row.status,
      createdAt: row.created_at,
    },
  });
});

// PATCH /api/actions/:id — updates action status (e.g. approved -> executed or rejected)
actionsRouter.patch('/:id', (req, res) => {
  const { status } = req.body as { status?: string };
  const validStatuses = ['pending', 'approved', 'rejected', 'executed'];

  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`,
    });
    return;
  }

  const existing = dbGet<ActionRow>('SELECT * FROM actions WHERE id=?', [req.params['id']]);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Action not found.' });
    return;
  }

  dbRun('UPDATE actions SET status=? WHERE id=?', [status, req.params['id']]);
  const updated = dbGet<ActionRow>('SELECT * FROM actions WHERE id=?', [req.params['id']])!;

  res.json({
    success: true,
    data: {
      actionId: updated.id,
      sessionId: updated.session_id,
      taskId: updated.task_id ?? undefined,
      actionType: updated.action_type,
      status: updated.status,
      createdAt: updated.created_at,
    },
  });
});

function stripAuth(url: string): string {
  try {
    const u = new URL(url);
    ['token','access_token','auth','key','apikey','secret','session'].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return ''; }
}
