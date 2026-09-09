/**
 * PRIVEDGE Phase 8 — Benchmark Test Suite
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Verifies benchmark execution, metric computations, non-fabrication rules,
 * and privacy boundaries.
 *
 * Run: node --experimental-strip-types --no-warnings lib/benchmark/benchmark.test.ts
 */

import assert from 'node:assert/strict';
import { runSihBenchmark } from './runner';
import { computePrecision, computeRecall, computeF1 } from './metrics';
import { SYNTHETIC_PII_DATASET } from './datasets';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    })
    .catch(error => {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(error);
      failed++;
    });
}

async function run(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PRIVEDGE Phase 8: Benchmark & SIH Evaluation');
  console.log('═══════════════════════════════════════════════════\n');

  // Math sanity tests
  await test('1. Statistical metrics: Precision & Recall calculation accuracy', () => {
    assert.equal(computePrecision(8, 2), 0.8);
    assert.equal(computeRecall(8, 2), 0.8);
    assert.equal(computeF1(0.8, 0.8), 0.8);
    assert.equal(computePrecision(0, 0), 0);
    assert.equal(computeRecall(0, 0), 0);
  });

  const report = await runSihBenchmark();

  // Criterion 1: Visual context accuracy
  await test('2. Criterion 1: Visual Context Accuracy reported truthfully (no fabrication)', () => {
    const visual = report.criteria.visualContextAccuracy;
    assert.equal(visual.status, 'NOT MEASURED');
    assert(visual.notes.includes('WebGPU'));
    assert.equal(report.weightings.visualContextAccuracy, '25%');
  });

  // Criterion 2: PII Detection Precision / Recall
  await test('3. Criterion 2: PII Detection Precision & Recall measured on synthetic data', () => {
    const pii = report.criteria.piiDetection;
    assert.equal(pii.status, 'MEASURED');
    assert(pii.precision > 0, 'precision must be positive');
    assert(pii.recall > 0, 'recall must be positive');
    assert.equal(typeof pii.tp, 'number');
    assert.equal(typeof pii.fp, 'number');
    assert.equal(typeof pii.fn, 'number');
    assert.equal(report.weightings.piiDetection, '20%');
  });

  // Criterion 3: Redaction Precision
  await test('4. Criterion 3: Redaction Precision measured on Privacy Firewall decisions', () => {
    const redaction = report.criteria.redactionPrecision;
    assert.equal(redaction.status, 'MEASURED');
    assert(redaction.precision > 0, 'redaction precision must be positive');
    assert(redaction.correctRedactions > 0, 'correct redactions must be positive');
    assert.equal(report.weightings.redactionPrecision, '20%');
  });

  // Criterion 4: Client-side Resources
  await test('5. Criterion 4: Client Resources measured from runtime process APIs', () => {
    const resources = report.criteria.clientResources;
    assert.equal(resources.status, 'MEASURED');
    assert(typeof resources.heapUsedMb === 'number' && resources.heapUsedMb > 0, 'heapUsedMb measured');
    assert(typeof resources.inferenceDurationMs === 'number', 'duration measured');
    assert(resources.runtimeEngine.includes('Node'), 'engine reported');
    assert.equal(report.weightings.clientResources, '20%');
  });

  // Criterion 5: End-to-end Latency
  await test('6. Criterion 5: End-to-end Latency measured across stages', () => {
    const latency = report.criteria.endToEndLatency;
    assert.equal(latency.status, 'MEASURED');
    assert(latency.totalMs > 0, 'totalMs must be positive');
    assert(typeof latency.firewallMs === 'number', 'firewallMs measured');
    assert(typeof latency.reasoningMs === 'number', 'reasoningMs measured');
    assert(typeof latency.actionGuardMs === 'number', 'actionGuardMs measured');
    assert.equal(report.weightings.endToEndLatency, '15%');
  });

  // Privacy invariant
  await test('7. Privacy invariant: Synthetic test dataset contains ZERO real personal data', () => {
    for (const tc of SYNTHETIC_PII_DATASET) {
      const isSynthetic = tc.id.startsWith('test-') && (
        tc.description.toLowerCase().includes('synth') ||
        tc.expectedCategory === 'SAFE' ||
        JSON.stringify(tc.element).toLowerCase().includes('synth') ||
        JSON.stringify(tc.element).toLowerCase().includes('example')
      );
      assert(isSynthetic, `testcase ${tc.id} must be synthetic or safe`);
    }
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error running benchmark tests:', err);
  process.exit(1);
});
