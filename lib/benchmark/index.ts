/**
 * PRIVEDGE Phase 8 — Benchmark System Entry Point
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 */

export * from './types';
export * from './datasets';
export * from './metrics';
export * from './runner';

import { runSihBenchmark } from './runner';
import type { SihBenchmarkReport } from './types';

let cachedReport: SihBenchmarkReport | null = null;

export async function getBenchmarkReport(forceFresh = false): Promise<SihBenchmarkReport> {
  if (cachedReport && !forceFresh) {
    return cachedReport;
  }
  cachedReport = await runSihBenchmark();
  return cachedReport;
}
