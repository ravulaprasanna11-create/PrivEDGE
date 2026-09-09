import { Router } from 'express';
import { randomUUID } from 'crypto';
import { dbRun, dbGet, dbAll } from '../db/database';
import type { TaskRow, ContextRow } from '../types/api';

export const tasksRouter: Router = Router();

tasksRouter.post('/', (req, res) => {
  const { sessionId, title } = req.body as { sessionId?: string; title?: string };
  if (!sessionId) { res.status(400).json({ success: false, error: 'sessionId required.' }); return; }
  if (!title?.trim()) { res.status(400).json({ success: false, error: 'title required.' }); return; }
  if (!dbGet('SELECT id FROM sessions WHERE id=?', [sessionId])) {
    res.status(404).json({ success: false, error: 'Session not found.' }); return;
  }
  const id = randomUUID(); const now = Date.now();
  dbRun('INSERT INTO tasks (id,session_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    [id, sessionId, title.trim(), 'pending', now, now]);
  res.status(201).json({ success: true, data: dbGet<TaskRow>('SELECT * FROM tasks WHERE id=?', [id]) });
});

tasksRouter.get('/:id', (req, res) => {
  const task = dbGet<TaskRow>('SELECT * FROM tasks WHERE id=?', [req.params['id']]);
  if (!task) { res.status(404).json({ success: false, error: 'Task not found.' }); return; }
  const contexts = dbAll<Pick<ContextRow,'id'|'redaction_summary'|'disclosure_metadata'|'created_at'>>(
    'SELECT id,redaction_summary,disclosure_metadata,created_at FROM sanitized_contexts WHERE task_id=? ORDER BY created_at ASC',
    [req.params['id']]
  );
  res.json({ success: true, data: { task, contexts } });
});
