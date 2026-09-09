-- PRIVEDGE Phase 5 — SQLite Schema
-- SIH26171: Privacy-Preserving Browser Agent
--
-- INVARIANT: No raw PII, raw DOM, raw screenshots, tokens,
-- cookies, or raw sensitive values are EVER stored.
-- Only sanitized / minimum-disclosure data is persisted.

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','completed','error'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','in_progress','completed','failed')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Only safe/sanitized columns — no raw PII columns ever defined here.
CREATE TABLE IF NOT EXISTS sanitized_contexts (
  id                       TEXT PRIMARY KEY,
  session_id               TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_id                  TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  page_metadata            TEXT NOT NULL,   -- JSON: safe title/origin/domain/viewport
  structure                TEXT NOT NULL,   -- JSON: safe element structure, no raw values
  redaction_summary        TEXT NOT NULL,   -- JSON: counts + types, no raw values
  disclosure_metadata      TEXT NOT NULL,   -- JSON: firewall summary counts
  sanitized_visual_context TEXT,            -- JSON: bounding boxes + decisions only
  created_at               INTEGER NOT NULL
);

-- Action proposals only — never executed here.
CREATE TABLE IF NOT EXISTS actions (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_id     TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK(action_type IN ('click','scroll','navigate')),
  target      TEXT NOT NULL,   -- JSON: elementId / coordinates / safe url
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected','executed')),
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_session    ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_ctx_session      ON sanitized_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_ctx_task         ON sanitized_contexts(task_id);
CREATE INDEX IF NOT EXISTS idx_actions_session  ON actions(session_id);
