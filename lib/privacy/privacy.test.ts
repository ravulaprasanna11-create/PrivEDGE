/**
 * PRIVEDGE Phase 1: Local Privacy Core - Test Suite
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Standalone, dependency-free test suite verifying all 20 required tests
 * and the fundamental Local Privacy Core security invariant.
 */

import assert from 'node:assert/strict';
import {
  detectSensitiveData,
  applyPrivacyPolicy,
  evaluateElementPolicy,
  sanitizeContext,
  applyMinimumDisclosure,
  validateOutboundContext,
  runLocalPrivacyPipeline
} from './index';
import type { BrowserContext, BrowserElement } from './types';

let passedTests = 0;
let failedTests = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(error);
    failedTests++;
  }
}

console.log('====================================================');
console.log('PRIVEDGE PHASE 1: LOCAL PRIVACY CORE TEST SUITE');
console.log('====================================================\n');

// 1. PASSWORD → BLOCK
runTest('1. PASSWORD → BLOCK', () => {
  const el: BrowserElement = {
    id: 'pwd-input',
    tagName: 'input',
    type: 'password',
    value: 'secret_pass_123'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Login' },
    elements: [el]
  });
  assert.equal(detections.length, 1);
  assert.equal(detections[0].category, 'PASSWORD');
  assert.equal(applyPrivacyPolicy(detections[0].category), 'BLOCK');
});

// 2. AADHAAR → BLOCK
runTest('2. AADHAAR → BLOCK', () => {
  const el: BrowserElement = {
    id: 'aadhaar-input',
    tagName: 'input',
    name: 'aadhaar_number',
    value: '2345 6789 0123'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'KYC' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'AADHAAR'));
  assert.equal(applyPrivacyPolicy('AADHAAR'), 'BLOCK');
});

// 3. PAN → BLOCK
runTest('3. PAN → BLOCK', () => {
  const el: BrowserElement = {
    id: 'pan-input',
    tagName: 'input',
    name: 'pan_card',
    value: 'ABCDE1234F'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'KYC' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'PAN'));
  assert.equal(applyPrivacyPolicy('PAN'), 'BLOCK');
});

// 4. EMAIL → MASK
runTest('4. EMAIL → MASK', () => {
  const el: BrowserElement = {
    id: 'email-input',
    tagName: 'input',
    type: 'email',
    value: 'user@domain.com'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Register' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'EMAIL'));
  assert.equal(applyPrivacyPolicy('EMAIL'), 'MASK');
});

// 5. PHONE → MASK
runTest('5. PHONE → MASK', () => {
  const el: BrowserElement = {
    id: 'phone-input',
    tagName: 'input',
    type: 'tel',
    value: '+91 9876543210'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Register' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'PHONE'));
  assert.equal(applyPrivacyPolicy('PHONE'), 'MASK');
});

// 6. NAME → MASK
runTest('6. NAME → MASK', () => {
  const el: BrowserElement = {
    id: 'name-input',
    tagName: 'input',
    autocomplete: 'name',
    value: 'Dr. Vikram Sarabhai'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Profile' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'NAME'));
  assert.equal(applyPrivacyPolicy('NAME'), 'MASK');
});

// 7. DOB → MASK
runTest('7. DOB → MASK', () => {
  const el: BrowserElement = {
    id: 'dob-input',
    tagName: 'input',
    autocomplete: 'bday',
    value: '1969-08-15'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Profile' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'DOB'));
  assert.equal(applyPrivacyPolicy('DOB'), 'MASK');
});

// 8. ADDRESS → MASK
runTest('8. ADDRESS → MASK', () => {
  const el: BrowserElement = {
    id: 'address-input',
    tagName: 'textarea',
    autocomplete: 'street-address',
    value: 'ISRO HQ, Antariksh Bhavan, New BEL Road, Bengaluru'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Contact' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'ADDRESS'));
  assert.equal(applyPrivacyPolicy('ADDRESS'), 'MASK');
});

// 9. Safe button → ALLOW
runTest('9. safe button → ALLOW', () => {
  const el: BrowserElement = {
    id: 'btn-submit',
    tagName: 'button',
    text: 'Submit Application',
    isInteractive: true
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Form' },
    elements: [el]
  });
  const policy = evaluateElementPolicy(el.id, detections);
  assert.equal(policy.decision, 'ALLOW');
});

// 10. Unknown sensitive-looking data → BLOCK
runTest('10. unknown sensitive-looking data → BLOCK', () => {
  const el: BrowserElement = {
    id: 'secret-token',
    tagName: 'input',
    value: 'bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y5'
  };
  const detections = detectSensitiveData({
    page: { url: 'https://example.com', title: 'Auth' },
    elements: [el]
  });
  assert.ok(detections.some(d => d.category === 'UNKNOWN_SENSITIVE'));
  assert.equal(applyPrivacyPolicy('UNKNOWN_SENSITIVE'), 'BLOCK');
});

// 11. Blocked raw value absent from sanitized output
runTest('11. blocked raw value absent from sanitized output', () => {
  const rawPassword = 'SecretP@ssword99!';
  const rawAadhaar = '3456 7890 1234';
  const context: BrowserContext = {
    page: { url: 'https://example.com', title: 'Security' },
    elements: [
      { id: 'p1', tagName: 'input', type: 'password', value: rawPassword },
      { id: 'a1', tagName: 'input', name: 'aadhaar', value: rawAadhaar }
    ]
  };
  const detections = detectSensitiveData(context);
  const sanitized = sanitizeContext(context, detections);
  const jsonStr = JSON.stringify(sanitized);
  assert.equal(jsonStr.includes(rawPassword), false);
  assert.equal(jsonStr.includes(rawAadhaar), false);
  assert.equal(sanitized.elements[0].value, '[BLOCKED_SENSITIVE_DATA]');
  assert.equal(sanitized.elements[1].value, '[BLOCKED_SENSITIVE_DATA]');
});

// 12. Email raw value absent after sanitization
runTest('12. email raw value absent after sanitization', () => {
  const rawEmail = 'scientist@isro.gov.in';
  const context: BrowserContext = {
    page: { url: 'https://example.com', title: 'Portal' },
    elements: [{ id: 'e1', tagName: 'input', type: 'email', value: rawEmail }]
  };
  const detections = detectSensitiveData(context);
  const sanitized = sanitizeContext(context, detections);
  const jsonStr = JSON.stringify(sanitized);
  assert.equal(jsonStr.includes(rawEmail), false);
  assert.equal(sanitized.elements[0].value, '[REDACTED_EMAIL]');
});

// 13. Phone raw value absent after sanitization
runTest('13. phone raw value absent after sanitization', () => {
  const rawPhone = '+91 9876543210';
  const context: BrowserContext = {
    page: { url: 'https://example.com', title: 'Portal' },
    elements: [{ id: 'ph1', tagName: 'input', type: 'tel', value: rawPhone }]
  };
  const detections = detectSensitiveData(context);
  const sanitized = sanitizeContext(context, detections);
  const jsonStr = JSON.stringify(sanitized);
  assert.equal(jsonStr.includes(rawPhone), false);
  assert.equal(sanitized.elements[0].value, '[REDACTED_PHONE]');
});

// 14. Validator rejects manually injected password
runTest('14. validator rejects manually injected password', () => {
  const fakeSanitizedPayload = {
    page: { url: 'https://example.com', title: 'Fake' },
    elements: [
      { id: 'p1', tagName: 'input', type: 'password', decision: 'ALLOW', value: 'injected_pwd' }
    ],
    sanitizedAt: Date.now(),
    redactionCount: 0,
    blockedCount: 0
  };
  const result = validateOutboundContext(fakeSanitizedPayload);
  assert.equal(result.isValid, false);
  assert.ok(result.errors && result.errors.length > 0);
});

// 15. Validator rejects manually injected Aadhaar
runTest('15. validator rejects manually injected Aadhaar', () => {
  const fakeSanitizedPayload = {
    page: { url: 'https://example.com', title: 'Fake' },
    elements: [
      { id: 'a1', tagName: 'div', decision: 'ALLOW', text: 'Contact Aadhaar 2345 6789 0123' }
    ],
    sanitizedAt: Date.now(),
    redactionCount: 0,
    blockedCount: 0
  };
  const result = validateOutboundContext(fakeSanitizedPayload);
  assert.equal(result.isValid, false);
});

// 16. Validator rejects manually injected PAN
runTest('16. validator rejects manually injected PAN', () => {
  const fakeSanitizedPayload = {
    page: { url: 'https://example.com', title: 'Fake' },
    elements: [
      { id: 'pan1', tagName: 'div', decision: 'ALLOW', text: 'Tax ID is ABCDE1234F' }
    ],
    sanitizedAt: Date.now(),
    redactionCount: 0,
    blockedCount: 0
  };
  const result = validateOutboundContext(fakeSanitizedPayload);
  assert.equal(result.isValid, false);
});

// 17. Validator rejects malformed payload
runTest('17. validator rejects malformed payload', () => {
  assert.equal(validateOutboundContext(null).isValid, false);
  assert.equal(validateOutboundContext('string').isValid, false);
  assert.equal(validateOutboundContext({}).isValid, false);
  assert.equal(validateOutboundContext({ page: null, elements: 'not-an-array' }).isValid, false);
});

// 18. Minimum disclosure does not expose email value
runTest('18. minimum disclosure does not expose email value', () => {
  const rawEmail = 'officer@isro.res.in';
  const context: BrowserContext = {
    page: { url: 'https://example.com', title: 'Task Page' },
    taskInstruction: 'Find the email field',
    elements: [
      { id: 'e1', tagName: 'input', type: 'email', value: rawEmail },
      { id: 'btn', tagName: 'button', text: 'Next' }
    ]
  };
  const detections = detectSensitiveData(context);
  const sanitized = sanitizeContext(context, detections);
  const disclosed = applyMinimumDisclosure(sanitized, 'Find the email field');
  const jsonStr = JSON.stringify(disclosed);
  assert.equal(jsonStr.includes(rawEmail), false);
  const emailEl = disclosed.elements.find(e => e.id === 'e1');
  assert.ok(emailEl);
  assert.equal(emailEl?.isPopulated, true);
  assert.equal(emailEl?.value, '[REDACTED_EMAIL]');
});

// 19. Complete safe pipeline succeeds
runTest('19. complete safe pipeline succeeds', () => {
  const context: BrowserContext = {
    page: { url: 'https://isro.gov.in', title: 'Mission Portal' },
    elements: [
      { id: 'email', tagName: 'input', type: 'email', value: 'scientist@isro.gov.in' },
      { id: 'phone', tagName: 'input', type: 'tel', value: '+91 9988776655' },
      { id: 'btn-proceed', tagName: 'button', text: 'Proceed', isInteractive: true }
    ],
    taskInstruction: 'Click Proceed'
  };
  const result = runLocalPrivacyPipeline(context);
  assert.equal(result.success, true);
  assert.ok(result.outboundContext);
  assert.equal(result.diagnostics.status, 'SUCCESS');
});

// 20. Unsafe pipeline fails closed
runTest('20. unsafe pipeline fails closed', () => {
  // Pass a severely corrupted context structure
  const corruptedContext = {
    page: null,
    elements: null
  } as unknown as BrowserContext;

  const result = runLocalPrivacyPipeline(corruptedContext);
  assert.equal(result.success, false);
  assert.equal(result.outboundContext, undefined);
  assert.equal(result.diagnostics.status, 'FAILED_VALIDATION');
});

// 21. SECURITY INVARIANT TEST
runTest('21. SECURITY INVARIANT: RAW PII NEVER IN OUTBOUND PAYLOAD', () => {
  const rawPiiValues = [
    'SuperSecretMasterPassword#2026',
    '8765 4321 0987',
    'AWBPC9988K',
    'director@sac.isro.gov.in',
    '+91 9123456780',
    'Satyendra Nath Bose',
    '1947-08-15',
    'Antariksh Bhavan, Bengaluru'
  ];

  const fullContext: BrowserContext = {
    page: { url: 'https://mission.isro.gov.in', title: 'Classified Mission Portal' },
    elements: [
      { id: 'pwd', tagName: 'input', type: 'password', value: rawPiiValues[0] },
      { id: 'aadhaar', tagName: 'input', name: 'aadhaar', value: rawPiiValues[1] },
      { id: 'pan', tagName: 'input', name: 'pan', value: rawPiiValues[2] },
      { id: 'email', tagName: 'input', type: 'email', value: rawPiiValues[3] },
      { id: 'phone', tagName: 'input', type: 'tel', value: rawPiiValues[4] },
      { id: 'name', tagName: 'input', autocomplete: 'name', value: rawPiiValues[5] },
      { id: 'dob', tagName: 'input', autocomplete: 'bday', value: rawPiiValues[6] },
      { id: 'addr', tagName: 'textarea', autocomplete: 'street-address', value: rawPiiValues[7] },
      { id: 'btn', tagName: 'button', text: 'Submit Mission Plan', isInteractive: true }
    ],
    taskInstruction: 'Submit Mission Plan'
  };

  const pipelineResult = runLocalPrivacyPipeline(fullContext);

  assert.equal(pipelineResult.success, true);
  assert.ok(pipelineResult.outboundContext);

  const outboundJson = JSON.stringify(pipelineResult.outboundContext);

  // Assert absolutely none of the raw PII strings exist anywhere in the payload
  for (const rawPii of rawPiiValues) {
    assert.equal(
      outboundJson.includes(rawPii),
      false,
      `Security Invariant Violated: Raw PII '${rawPii}' leaked into outbound payload!`
    );
  }

  // Verify outbound payload passes independent validation directly
  const independentValidation = validateOutboundContext(pipelineResult.outboundContext);
  assert.equal(independentValidation.isValid, true);
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} passed / ${failedTests} failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
