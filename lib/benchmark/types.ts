/**
 * PRIVEDGE Phase 8 — Benchmark Types & SIH26171 Evaluation Criteria
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Formal contracts for the 5 evaluation criteria:
 * 1. Visual context accuracy (25%)
 * 2. PII detection precision/recall (20%)
 * 3. Redaction precision (20%)
 * 4. Client-side resource utilization (20%)
 * 5. End-to-end latency (15%)
 *
 * INVARIANT: Never invent or fabricate benchmark metrics. Unmeasured dimensions
 * must be explicitly marked NOT MEASURED with a clear reason.
 */

export type MetricStatus = 'MEASURED' | 'PARTIALLY MEASURED' | 'NOT MEASURED';

/**
 * Criterion 1: Visual Context Accuracy (25% weighting)
 */
export interface VisualAccuracyMetric {
  status: MetricStatus;
  accuracy?: number;
  totalExpected: number;
  correctDetections: number;
  missedDetections: number;
  falseDetections: number;
  notes: string;
}

/**
 * Criterion 2: PII Detection Precision / Recall (20% weighting)
 */
export interface PiiDetectionMetric {
  status: MetricStatus;
  precision: number;
  recall: number;
  f1Score: number;
  tp: number;
  fp: number;
  fn: number;
  categoryBreakdown: Record<string, { tp: number; fp: number; fn: number; precision: number; recall: number }>;
}

/**
 * Criterion 3: Redaction Precision (20% weighting)
 */
export interface RedactionPrecisionMetric {
  status: MetricStatus;
  precision: number;
  correctRedactions: number;
  falseRedactions: number;
  missedSensitive: number;
  totalElementsTested: number;
}

/**
 * Criterion 4: Client-side Resource Utilization (20% weighting)
 */
export interface ClientResourceMetric {
  status: MetricStatus;
  heapUsedMb?: number;
  inferenceDurationMs?: number;
  runtimeEngine: string;
  notes: string;
}

/**
 * Criterion 5: End-to-End Pipeline Latency (15% weighting)
 */
export interface LatencyMetric {
  status: MetricStatus;
  captureMs: number;
  perceptionMs: number;
  firewallMs: number;
  reasoningMs: number;
  actionGuardMs: number;
  totalMs: number;
  iterations: number;
  method: string;
}

/**
 * Comprehensive SIH26171 Benchmark Report
 */
export interface SihBenchmarkReport {
  timestamp: number;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  criteria: {
    visualContextAccuracy: VisualAccuracyMetric;
    piiDetection: PiiDetectionMetric;
    redactionPrecision: RedactionPrecisionMetric;
    clientResources: ClientResourceMetric;
    endToEndLatency: LatencyMetric;
  };
  weightings: {
    visualContextAccuracy: '25%';
    piiDetection: '20%';
    redactionPrecision: '20%';
    clientResources: '20%';
    endToEndLatency: '15%';
  };
}
