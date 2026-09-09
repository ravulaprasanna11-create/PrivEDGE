/**
 * PRIVEDGE Phase 1: Local Privacy Core - Safe Logger
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Safe metadata-only logger.
 * STRICT INVARIANT:
 * NEVER logs raw PII, screenshots, raw DOM, passwords, tokens, cookies,
 * or full browser contexts.
 */

import type { SafeLogEntry } from './types';

class SafePrivacyLogger {
  private logs: SafeLogEntry[] = [];
  private maxLogs: number = 100;

  public log(entry: Omit<SafeLogEntry, 'timestamp'>): void {
    const safeEntry: SafeLogEntry = {
      timestamp: Date.now(),
      category: entry.category,
      decision: entry.decision,
      confidence: entry.confidence !== undefined ? Number(entry.confidence.toFixed(2)) : undefined,
      reason: this.sanitizeLogString(entry.reason),
      count: entry.count,
      status: this.sanitizeLogString(entry.status)
    };

    this.logs.push(safeEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  public getSafeLogs(): readonly SafeLogEntry[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
  }

  /**
   * Sanitizes string to avoid accidental inclusion of sensitive patterns.
   */
  private sanitizeLogString(str: string): string {
    if (!str) return '';
    // Strip anything that looks like an email or digits sequence
    return str
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
      .replace(/\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_AADHAAR]')
      .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[REDACTED_PAN]')
      .replace(/(?:(?:\+|00)91[\s.-]?)?[6-9]\d{9}\b/g, '[REDACTED_PHONE]');
  }
}

export const safeLogger = new SafePrivacyLogger();
