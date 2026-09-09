import { Router } from 'express';
import { randomUUID } from 'crypto';
import { dbRun, dbGet, dbAll } from '../db/database';
import type { SessionRow, TaskRow } from '../types/api';

export const sessionsRouter: Router = Router();

sessionsRouter.post('/', (_req, res) => {
  const id = randomUUID();
  const now = Date.now();
  dbRun('INSERT INTO sessions (id, created_at, updated_at, status) VALUES (?,?,?,?)', [id, now, now, 'active']);
  res.status(201).json({ success: true, data: dbGet<SessionRow>('SELECT * FROM sessions WHERE id=?', [id]) });
});

sessionsRouter.get('/:id', (req, res) => {
  const session = dbGet<SessionRow>('SELECT * FROM sessions WHERE id=?', [req.params['id']]);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found.' }); return; }
  const tasks = dbAll<Pick<TaskRow,'id'|'title'|'status'|'created_at'>>(
    'SELECT id,title,status,created_at FROM tasks WHERE session_id=? ORDER BY created_at ASC',
    [req.params['id']]
  );
  res.json({ success: true, data: { session, tasks } });
});
