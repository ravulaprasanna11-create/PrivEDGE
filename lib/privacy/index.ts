/**
 * PRIVEDGE Phase 1: Local Privacy Core - Public API
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Public interface for Phase 1 local privacy processing.
 */

export { detectSensitiveData } from './detector';
export { applyPrivacyPolicy, evaluateElementPolicy } from './policy';
export { sanitizeContext, sanitizeElement, sanitizeInlineText } from './sanitizer';
export { applyMinimumDisclosure } from './disclosure';
export { validateOutboundContext } from './validator';
export { runLocalPrivacyPipeline } from './pipeline';
export { safeLogger } from './logger';

export type {
  BrowserContext,
  PageMetadata,
  BrowserElement,
  SensitiveCategory,
  DetectionResult,
  PrivacyDecision,
  SanitizedElement,
  SanitizedContext,
  ValidatedOutboundContext,
  PipelineResult,
  SafeLogEntry
} from './types';
