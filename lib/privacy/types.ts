/**
 * PRIVEDGE Phase 1: Local Privacy Core - Type Definitions
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Strongly typed data models for local privacy processing before outbound transmission.
 */

export type SensitiveCategory =
  | 'NAME'
  | 'EMAIL'
  | 'PHONE'
  | 'AADHAAR'
  | 'PAN'
  | 'PASSWORD'
  | 'DOB'
  | 'ADDRESS'
  | 'UNKNOWN_SENSITIVE';

export type PrivacyDecision = 'ALLOW' | 'MASK' | 'BLOCK';

export interface PageMetadata {
  url: string;
  title: string;
  domain?: string;
}

export interface BrowserElement {
  id: string;
  tagName: string;
  type?: string;
  name?: string;
  selector?: string;
  role?: string;
  ariaLabel?: string;
  label?: string;
  placeholder?: string;
  autocomplete?: string;
  value?: string;
  text?: string;
  surroundingText?: string;
  isInteractive?: boolean;
  isVisible?: boolean;
  attributes?: Record<string, string>;
}

export interface BrowserContext {
  page: PageMetadata;
  elements: BrowserElement[];
  taskInstruction?: string;
  timestamp?: number;
}

export interface DetectionResult {
  elementId: string;
  category: SensitiveCategory;
  confidence: number;
  reason: string;
  detectedPattern?: string;
}

export interface SanitizedElement {
  id: string;
  tagName: string;
  type?: string;
  name?: string;
  selector?: string;
  role?: string;
  ariaLabel?: string;
  label?: string;
  placeholder?: string;
  decision: PrivacyDecision;
  category?: SensitiveCategory;
  value?: string;
  text?: string;
  surroundingText?: string;
  isPopulated?: boolean;
  isInteractive?: boolean;
  isVisible?: boolean;
}

export interface SanitizedContext {
  page: PageMetadata;
  elements: SanitizedElement[];
  taskInstruction?: string;
  sanitizedAt: number;
  redactionCount: number;
  blockedCount: number;
}

export interface ValidatedOutboundContext {
  isValid: boolean;
  context?: SanitizedContext;
  errors?: string[];
  validatedAt: number;
  diagnostics?: {
    blockedViolationsCount: number;
    unmaskedSensitiveCount: number;
    reasons: string[];
  };
}

export interface PipelineResult {
  success: boolean;
  outboundContext?: SanitizedContext;
  diagnostics: {
    status: 'SUCCESS' | 'FAILED_VALIDATION' | 'BLOCKED';
    detectionsCount: number;
    blockedCount: number;
    maskedCount: number;
    allowedCount: number;
    validationErrors?: string[];
    timestamp: number;
  };
}

export interface SafeLogEntry {
  timestamp: number;
  category?: SensitiveCategory;
  decision?: PrivacyDecision;
  confidence?: number;
  reason: string;
  count?: number;
  status: string;
}
