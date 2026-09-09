/**
 * PRIVEDGE Phase 8 — Synthetic Benchmark Datasets
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Fixed, deterministic, non-real evaluation datasets for reproducibility.
 * STRICT INVARIANT: ZERO real personal information or sensitive user data.
 */

import type { BrowserElement } from '../privacy/types';
import type { FirewallCategory, FirewallDecision } from '../firewall/types';

export interface SyntheticPiiTestCase {
  id: string;
  element: BrowserElement;
  expectedCategory: FirewallCategory;
  expectedDecision: FirewallDecision;
  description: string;
}

export interface SyntheticVisualTestCase {
  id: string;
  expectedLabel: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  category: FirewallCategory;
}

/**
 * Deterministic synthetic PII and privacy firewall test cases.
 */
export const SYNTHETIC_PII_DATASET: SyntheticPiiTestCase[] = [
  // 1. Password field
  {
    id: 'test-pwd-1',
    element: {
      id: 'test-pwd-1',
      tagName: 'input',
      type: 'password',
      name: 'user_password',
      placeholder: 'Enter password',
      value: 'SynthP@ssw0rd99!',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'PASSWORD',
    expectedDecision: 'BLOCK',
    description: 'Password input field with raw credential',
  },
  // 2. Aadhaar-like synthetic 12-digit number
  {
    id: 'test-aadhaar-1',
    element: {
      id: 'test-aadhaar-1',
      tagName: 'input',
      type: 'text',
      name: 'aadhaar_number',
      placeholder: '12-digit Aadhaar',
      value: '9876 5432 1098',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'AADHAAR',
    expectedDecision: 'BLOCK',
    description: 'Aadhaar synthetic 12-digit format',
  },
  // 3. PAN-like synthetic 10-char alphanumeric
  {
    id: 'test-pan-1',
    element: {
      id: 'test-pan-1',
      tagName: 'input',
      type: 'text',
      name: 'pan_card',
      placeholder: 'PAN Number',
      value: 'ABCDE1234F',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'PAN',
    expectedDecision: 'BLOCK',
    description: 'PAN card synthetic uppercase alphanumeric',
  },
  // 4. Email address
  {
    id: 'test-email-1',
    element: {
      id: 'test-email-1',
      tagName: 'input',
      type: 'email',
      name: 'contact_email',
      placeholder: 'user@example.com',
      value: 'synth.user42@example.invalid',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'EMAIL',
    expectedDecision: 'MASK',
    description: 'Synthetic email address in input element',
  },
  // 5. Phone number
  {
    id: 'test-phone-1',
    element: {
      id: 'test-phone-1',
      tagName: 'input',
      type: 'tel',
      name: 'mobile_phone',
      placeholder: 'Phone Number',
      value: '+91 9876543210',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'PHONE',
    expectedDecision: 'MASK',
    description: 'Synthetic 10-digit telephone number',
  },
  // 6. Date of Birth
  {
    id: 'test-dob-1',
    element: {
      id: 'test-dob-1',
      tagName: 'input',
      type: 'text',
      name: 'date_of_birth',
      placeholder: 'YYYY-MM-DD',
      value: '1995-08-15',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'DOB',
    expectedDecision: 'MASK',
    description: 'Synthetic date of birth in ISO format',
  },
  // 7. Physical Address
  {
    id: 'test-addr-1',
    element: {
      id: 'test-addr-1',
      tagName: 'textarea',
      name: 'shipping_address',
      placeholder: 'Delivery address',
      value: 'Flat 402, Synthetic Residency, Tech Park Road, Bengaluru',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'ADDRESS',
    expectedDecision: 'MASK',
    description: 'Synthetic Indian street address',
  },
  // 8. Full Name
  {
    id: 'test-name-1',
    element: {
      id: 'test-name-1',
      tagName: 'input',
      type: 'text',
      name: 'full_name',
      placeholder: 'Full Name',
      value: 'Synth Aarav Kumar',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'NAME',
    expectedDecision: 'MASK',
    description: 'Synthetic full personal name',
  },
  // 9. Safe UI button (Non-sensitive)
  {
    id: 'test-safe-btn-1',
    element: {
      id: 'test-safe-btn-1',
      tagName: 'button',
      role: 'button',
      text: 'Submit Application',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'SAFE',
    expectedDecision: 'ALLOW',
    description: 'Standard submit button without sensitive content',
  },
  // 10. Safe search input (Non-sensitive)
  {
    id: 'test-safe-search-1',
    element: {
      id: 'test-safe-search-1',
      tagName: 'input',
      type: 'search',
      name: 'q',
      placeholder: 'Search documentation',
      value: 'satellite orbital mechanics',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'SAFE',
    expectedDecision: 'ALLOW',
    description: 'Non-sensitive domain search query',
  },
  // 11. Safe navigation link (Non-sensitive)
  {
    id: 'test-safe-link-1',
    element: {
      id: 'test-safe-link-1',
      tagName: 'a',
      role: 'link',
      text: 'Privacy Policy & Terms',
      isInteractive: true,
      isVisible: true,
    },
    expectedCategory: 'SAFE',
    expectedDecision: 'ALLOW',
    description: 'Standard informational footer link',
  },
  // 12. Safe heading/content (Non-sensitive)
  {
    id: 'test-safe-heading-1',
    element: {
      id: 'test-safe-heading-1',
      tagName: 'h1',
      text: 'National Space Science Data Center',
      isInteractive: false,
      isVisible: true,
    },
    expectedCategory: 'SAFE',
    expectedDecision: 'ALLOW',
    description: 'Public institutional portal heading',
  },
];

/**
 * Synthetic ground-truth UI regions for visual context accuracy.
 */
export const SYNTHETIC_VISUAL_DATASET: SyntheticVisualTestCase[] = [
  {
    id: 'vis-box-1',
    expectedLabel: 'button',
    boundingBox: { x: 50, y: 100, width: 120, height: 40 },
    category: 'SAFE',
  },
  {
    id: 'vis-box-2',
    expectedLabel: 'input',
    boundingBox: { x: 50, y: 160, width: 300, height: 40 },
    category: 'SAFE',
  },
  {
    id: 'vis-box-3',
    expectedLabel: 'person',
    boundingBox: { x: 400, y: 100, width: 150, height: 180 },
    category: 'FACE',
  },
];
