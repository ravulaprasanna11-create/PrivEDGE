/**
 * PRIVEDGE Phase 5 — SQLite Database Module
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Singleton SQLite instance with parameterized helpers.
 * Prefers better-sqlite3; falls back to Node.js native built-in node:sqlite (DatabaseSync)
 * if native bindings for the current Node runtime are unavailable.
 * The data directory is gitignored; schema is idempotent on startup.
 */

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface DatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
}

function resolveSchemaPath(): string {
  const candidates = [
    join(process.cwd(), 'src', 'db', 'schema.sql'),
    join(process.cwd(), 'backend', 'src', 'db', 'schema.sql'),
    join(process.cwd(), 'dist', 'db', 'schema.sql'),
    join(process.cwd(), 'backend', 'dist', 'db', 'schema.sql'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

function resolveDataDir(): string {
  if (process.env['PRIVEDGE_DB_DIR']) return process.env['PRIVEDGE_DB_DIR'];
  const candidates = [
    join(process.cwd(), 'data'),
    join(process.cwd(), 'backend', 'data'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return join(process.cwd(), 'data');
}

let _db: DatabaseLike | null = null;

function createSqliteConnection(dbPath: string): DatabaseLike {
  try {
    // Attempt better-sqlite3 first
    const proc = process as unknown as { getBuiltinModule?: (n: string) => typeof import('module') };
    const mod = proc.getBuiltinModule?.('module');
    const req = typeof require !== 'undefined'
      ? require
      : mod?.createRequire
        ? mod.createRequire(join(process.cwd(), 'package.json'))
        : null;

    if (req) {
      const BetterSqlite3 = req('better-sqlite3');
      return new BetterSqlite3(dbPath);
    }
  } catch {
    // Fall back to Node's built-in SQLite engine
  }

  // Fallback: Node.js built-in SQLite (DatabaseSync)
  const proc = process as unknown as { getBuiltinModule?: (n: string) => { DatabaseSync: new (p: string) => DatabaseLike } };
  const sqliteMod = proc.getBuiltinModule?.('node:sqlite');
  if (sqliteMod?.DatabaseSync) {
    return new sqliteMod.DatabaseSync(dbPath);
  }

  const mod = (process as unknown as { getBuiltinModule?: (n: string) => typeof import('module') }).getBuiltinModule?.('module');
  const req = typeof require !== 'undefined'
    ? require
    : mod?.createRequire
      ? mod.createRequire(join(process.cwd(), 'package.json'))
      : null;
  if (req) {
    const { DatabaseSync } = req('node:sqlite');
    return new DatabaseSync(dbPath);
  }

  throw new Error('No SQLite implementation available');
}

export function getDb(): DatabaseLike {
  if (_db) return _db;
  const dbDir = resolveDataDir();
  mkdirSync(dbDir, { recursive: true });
  const dbFile = process.env['PRIVEDGE_DB_FILE'] ?? 'privedge.db';
  const dbPath = join(dbDir, dbFile);
  const schemaPath = resolveSchemaPath();

  _db = createSqliteConnection(dbPath);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  _db.exec(readFileSync(schemaPath, 'utf-8'));
  return _db;
}

export function closeDb(): void {
  if (_db) { _db.close(); _db = null; }
}

// Thin parameterized helpers
export function dbRun(sql: string, params: unknown[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
  return getDb().prepare(sql).run(...params) as { changes: number | bigint; lastInsertRowid: number | bigint };
}
export function dbGet<T>(sql: string, params: unknown[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}
export function dbAll<T>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}
