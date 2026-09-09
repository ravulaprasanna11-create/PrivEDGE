/**
 * PRIVEDGE Phase 5 — API Type Definitions
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Server-side contracts. Mirrors Phase 4 MinimumDisclosure
 * with a mandatory PrivacyMarker.
 *
 * INVARIANT: No raw PII, raw screenshot, raw DOM, tokens,
 * or cookies may appear in any accepted or returned payload.
 */

// ── Decision mirrors Phase 4 ─────────────────────────────────────────────
export type FirewallDecision = 'ALLOW' | 'MASK' | 'BLOCK';

export type PrivacyCategory =
  | 'PASSWORD' | 'AADHAAR' | 'PAN' | 'EMAIL' | 'PHONE'
  | 'DOB' | 'ADDRESS' | 'NAME' | 'ACCOUNT_NUMBER'
  | 'FACE' | 'PERSON' | 'UNKNOWN_SENSITIVE' | 'SAFE';

export type RedactionMethod =
  | 'MASKED' | 'BLOCKED' | 'REDACTED' | 'BLACKED_OUT'
  | 'MASK'   | 'BLOCK'   | 'ALLOW';

export type ActionType     = 'click' | 'scroll' | 'navigate';
export type SessionStatus  = 'active' | 'completed' | 'error';
export type TaskStatus     = 'pending' | 'in_progress' | 'completed' | 'failed';
export type ActionStatus   = 'pending' | 'approved' | 'rejected' | 'executed';

// ── Inbound sanitized-context types (aligned with Phase 4 MinimumDisclosure) ─

export interface SafePageMetadata {
  url?: string;
  urlOrigin?: string;
  title?: string;
  titleSafe?: string;
  domain?: string;
  viewport?: { width: number; height: number };
}

export interface SafeElement {
  id?: string;
  stableId?: string;
  tagName?: string;
  type?: string;
  role?: string;
  label?: string;
  labelSafe?: string;
  ariaLabel?: string;
  placeholder?: string;
  decision: FirewallDecision;
  category?: PrivacyCategory;
  /** Placeholder string only — NEVER the raw value */
  value?: string;
  text?: string;
  isInteractive?: boolean;
  isVisible?: boolean;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x: number; y: number; width: number; height: number;
}

export interface RedactionRecord {
  type: PrivacyCategory;
  method: RedactionMethod;
  elementId?: string;
  boundingBox?: BoundingBox;
  reason: string;
}

export interface FirewallSummary {
  totalDetections: number;
  blockedCount: number;
  maskedCount: number;
  allowedCount: number;
  visualRedactedCount: number;
}

export interface SafeVisualRegion {
  id: string;
  decision: FirewallDecision;
  category?: PrivacyCategory;
  /** Safe label e.g., 'person', 'car', or '[REDACTED]' */
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
}

/**
 * Mandatory privacy marker — both fields must pass exactly.
 * Missing or incorrect → HTTP 400 (fail closed).
 */
export interface PrivacyMarker {
  sanitized: true;
  rawDataIncluded: false;
}

/**
 * The payload accepted by POST /api/contexts.
 * Directly mirrors Phase 4 MinimumDisclosure + mandatory PrivacyMarker.
 */
export interface InboundSanitizedContext {
  sessionId: string;
  taskId?: string;
  page: SafePageMetadata;
  elements: SafeElement[];
  visualRegions?: SafeVisualRegion[];
  visualContext?: SafeVisualRegion[];
  firewallSummary?: FirewallSummary;
  disclosure?: FirewallSummary;
  redactions?: RedactionRecord[];
  taskInstruction?: string;
  disclosedAt?: number;
  /** Must be { sanitized: true, rawDataIncluded: false } */
  privacy: PrivacyMarker;
}

// ── Action proposal ───────────────────────────────────────────────────────
export interface ActionTarget {
  elementId?: string;
  coordinates?: { x: number; y: number };
  url?: string;
  scrollDelta?: { x: number; y: number };
}
export interface ActionProposal {
  sessionId: string;
  taskId?: string;
  actionType: ActionType;
  target: ActionTarget;
}

// ── DB row shapes ─────────────────────────────────────────────────────────
export interface SessionRow {
  id: string; created_at: number; updated_at: number; status: SessionStatus;
}
export interface TaskRow {
  id: string; session_id: string; title: string;
  status: TaskStatus; created_at: number; updated_at: number;
}
export interface ContextRow {
  id: string; session_id: string; task_id: string | null;
  page_metadata: string; structure: string;
  redaction_summary: string; disclosure_metadata: string;
  sanitized_visual_context: string | null; created_at: number;
}
export interface ActionRow {
  id: string; session_id: string; task_id: string | null;
  action_type: ActionType; target: string; status: ActionStatus; created_at: number;
}

// ── Validation ────────────────────────────────────────────────────────────
export interface ValidationResult { valid: boolean; errors: string[]; }

/**
 * Any key whose presence in an inbound payload triggers immediate rejection.
 * Server never attempts to sanitize — fail closed.
 * Note: sessionId is a required safe identifier, NOT a forbidden key.
 */
export const FORBIDDEN_KEYS: readonly string[] = [
  'password', 'passwd', 'pwd',
  'token', 'authtoken', 'accesstoken', 'refreshtoken',
  'authorization', 'auth',
  'cookie', 'cookievalue',
  'sessiontoken',
  'rawscreenshot', 'screenshot',
  'rawdom', 'rawhtml', 'rawtext',
  'rawpii', 'rawvalue', 'originalvalue',
  'secret', 'apikey', 'privatekey',
  'credential', 'credentials',
] as const;
