/**
 * PRIVEDGE Phase 5 — Server Entry Point
 * SIH26171: Privacy-Preserving Browser Agent
 */

import { createApp } from './app';
import { getDb, closeDb } from './db/database';

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

getDb(); // initialise DB + schema on startup

const app = createApp();
const server = app.listen(PORT, () => {
  console.log(`[PRIVEDGE] Backend: http://localhost:${PORT}`);
  console.log(`[PRIVEDGE] Phase 5 – Privacy-Preserving Backend (SIH26171)`);
});

function shutdown(sig: string): void {
  console.log(`[PRIVEDGE] ${sig} – shutting down`);
  server.close(() => { closeDb(); process.exit(0); });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
