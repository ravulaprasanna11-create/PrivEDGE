/**
 * PRIVEDGE Phase 5 — Sanitized Context Validator
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * FAIL-CLOSED CONTRACT:
 * - Any FORBIDDEN_KEYS key anywhere in the payload → reject.
 * - privacy marker absent or incorrect → reject.
 * - Structural schema violations → reject.
 *
 * SECURITY: never logs the body. Never cleans forbidden fields.
 * Never echoes unsafe values in error messages.
 */

import type { InboundSanitizedContext, ValidationResult } from '../types/api';
import { FORBIDDEN_KEYS } from '../types/api';

// ── Recursive forbidden-key scanner ───────────────────────────────────────

function scanForbidden(value: unknown, path: string, found: string[]): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanForbidden(v, `${path}[${i}]`, found));
    return;
  }
  for (const key of Object.keys(value as object)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase() as typeof FORBIDDEN_KEYS[number])) {
      found.push(`${path}.${key}`);
      continue; // do NOT recurse into forbidden values
    }
    scanForbidden((value as Record<string,unknown>)[key], `${path}.${key}`, found);
  }
}

// ── Field validators ───────────────────────────────────────────────────────

function checkPrivacy(p: unknown, errors: string[]): boolean {
  if (!p || typeof p !== 'object') {
    errors.push('privacy marker is required.');
    return false;
  }
  const pm = p as Record<string, unknown>;
  if (pm['sanitized'] !== true) {
    errors.push('privacy.sanitized must be exactly true.');
    return false;
  }
  if (pm['rawDataIncluded'] !== false) {
    errors.push('privacy.rawDataIncluded must be exactly false.');
    return false;
  }
  return true;
}

function checkPage(page: unknown, errors: string[]): void {
  if (!page || typeof page !== 'object') { errors.push('page is required.'); return; }
  const p = page as Record<string, unknown>;
  const title = (typeof p['title'] === 'string' && p['title'].trim())
    || (typeof p['titleSafe'] === 'string' && p['titleSafe'].trim());
  if (!title)
    errors.push('page.title must be a non-empty string.');
}

function checkElements(els: unknown, errors: string[]): void {
  if (!Array.isArray(els)) { errors.push('elements must be an array.'); return; }
  const valid = new Set(['ALLOW','MASK','BLOCK']);
  els.forEach((el, i) => {
    if (!el || typeof el !== 'object') { errors.push(`elements[${i}] must be an object.`); return; }
    if (!valid.has((el as Record<string,unknown>)['decision'] as string))
      errors.push(`elements[${i}].decision must be ALLOW | MASK | BLOCK.`);
  });
}

function checkRedactions(reds: unknown, errors: string[]): void {
  if (reds === undefined) return; // Optional in Phase 4 MinimumDisclosure
  if (!Array.isArray(reds)) { errors.push('redactions must be an array.'); return; }
  reds.forEach((r, i) => {
    if (!r || typeof r !== 'object') { errors.push(`redactions[${i}] must be an object.`); return; }
    const rec = r as Record<string, unknown>;
    if (typeof rec['type'] !== 'string') errors.push(`redactions[${i}].type required.`);
    if (typeof rec['method'] !== 'string') errors.push(`redactions[${i}].method required.`);
    if (typeof rec['reason'] !== 'string') errors.push(`redactions[${i}].reason required.`);
  });
}

function checkSummary(b: Record<string, unknown>, errors: string[]): void {
  const d = (b['firewallSummary'] ?? b['disclosure']) as unknown;
  if (!d || typeof d !== 'object') { errors.push('firewallSummary or disclosure is required.'); return; }
  const dm = d as Record<string, unknown>;
  for (const f of ['totalDetections','blockedCount','maskedCount','allowedCount','visualRedactedCount'])
    if (typeof dm[f] !== 'number') errors.push(`firewallSummary.${f} must be a number.`);
}

/**
 * Adapter: if inbound payload has a nested Phase 4 MinimumDisclosure object in `disclosure`,
 * hoist page, elements, visualRegions, and firewallSummary while preserving sessionId and privacy.
 */
export function adaptInboundPayload(body: Record<string, unknown>): Record<string, unknown> {
  const d = body['disclosure'];
  if (d && typeof d === 'object' && 'elements' in (d as object) && 'page' in (d as object)) {
    const md = d as Record<string, unknown>;
    return {
      ...md,
      ...body,
      page: md['page'] ?? body['page'],
      elements: md['elements'] ?? body['elements'],
      visualRegions: md['visualRegions'] ?? body['visualRegions'],
      firewallSummary: md['firewallSummary'] ?? body['firewallSummary'],
    };
  }
  return body;
}

// ── Main export ────────────────────────────────────────────────────────────

export function validateSanitizedContext(rawBody: unknown): ValidationResult {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody))
    return { valid: false, errors: ['Body must be a JSON object.'] };

  // 1. Forbidden-key scan — highest priority (scans entire raw payload)
  const found: string[] = [];
  scanForbidden(rawBody, 'body', found);
  if (found.length > 0)
    return { valid: false, errors: [`Forbidden fields detected (${found.join(', ')}). Payload rejected.`] };

  const b = adaptInboundPayload(rawBody as Record<string, unknown>);
  const errors: string[] = [];

  // 2. Privacy marker first
  if (!checkPrivacy(b['privacy'], errors)) return { valid: false, errors };

  // 3. sessionId
  if (typeof b['sessionId'] !== 'string' || !b['sessionId'].trim())
    errors.push('sessionId must be a non-empty string.');

  // 4. Structural fields (aligned with Phase 4 MinimumDisclosure)
  checkPage(b['page'], errors);
  checkElements(b['elements'], errors);
  checkRedactions(b['redactions'], errors);
  checkSummary(b, errors);

  return { valid: errors.length === 0, errors };
}

/**
 * Build a safe redaction summary for storage.
 * Counts only — no raw values.
 */
export function buildRedactionSummary(ctx: InboundSanitizedContext): object {
  if (ctx.redactions && ctx.redactions.length > 0) {
    return {
      total: ctx.redactions.length,
      byType: ctx.redactions.reduce<Record<string,number>>((a,r) => {
        a[r.type] = (a[r.type] ?? 0) + 1; return a;
      }, {}),
      byMethod: ctx.redactions.reduce<Record<string,number>>((a,r) => {
        a[r.method] = (a[r.method] ?? 0) + 1; return a;
      }, {}),
    };
  }
  const blocked = (ctx.elements ?? []).filter(e => e.decision === 'BLOCK');
  const masked  = (ctx.elements ?? []).filter(e => e.decision === 'MASK');
  return {
    total: blocked.length + masked.length,
    byDecision: { BLOCK: blocked.length, MASK: masked.length },
  };
}
