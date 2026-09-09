/**
 * PRIVEDGE Phase 5 — Express App Factory
 * SIH26171: Privacy-Preserving Browser Agent
 */

import express from 'express';
import cors from 'cors';
import { healthRouter }   from './routes/health';
import { sessionsRouter } from './routes/sessions';
import { tasksRouter }    from './routes/tasks';
import { contextsRouter } from './routes/contexts';
import { actionsRouter }  from './routes/actions';
import { reasoningRouter } from './routes/reasoning';

const ALLOWED = [
  'http://localhost:3000',
  'http://localhost:3001',
];

export function createApp(): express.Application {
  const app = express();

  app.use(cors({
    origin: (origin, cb) => {
      // Allow same-origin / no-origin and chrome-extension:// and known localhost ports
      if (!origin || ALLOWED.includes(origin) || origin.startsWith('chrome-extension://')) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  }));

  // 1 MB body limit — do NOT log body content
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health',   healthRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/tasks',    tasksRouter);
  app.use('/api/contexts', contextsRouter);
  app.use('/api/actions',  actionsRouter);
  app.use('/api/reason',   reasoningRouter);

  app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found.' }));

  // Generic error handler — no stack traces, no body echo
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[PRIVEDGE]', err.message);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  });

  return app;
}
