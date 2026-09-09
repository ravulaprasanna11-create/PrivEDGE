/**
 * PRIVEDGE Phase 1: Local Privacy Core - Complete Local Pipeline
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Required Flow:
 * BrowserContext
 *   ↓ detectSensitiveData
 *   ↓ applyPrivacyPolicy
 *   ↓ sanitizeContext
 *   ↓ applyMinimumDisclosure
 *   ↓ validateOutboundContext
 *   ↓ ValidatedOutboundContext
 * 
 * Invariants:
 * - ZERO network/cloud calls.
 * - Fails closed: If validation fails, NEVER expose outbound payload.
 * - Diagnostics must NOT contain raw PII.
 */

import type { BrowserContext, PipelineResult } from './types';
import { detectSensitiveData } from './detector';
import { sanitizeContext } from './sanitizer';
import { applyMinimumDisclosure } from './disclosure';
import { validateOutboundContext } from './validator';
import { safeLogger } from './logger';

export function runLocalPrivacyPipeline(context: BrowserContext): PipelineResult {
  const timestamp = Date.now();

  try {
    if (!context || !context.page || !Array.isArray(context.elements)) {
      safeLogger.log({
        decision: 'BLOCK',
        reason: 'Invalid or malformed BrowserContext supplied to pipeline',
        status: 'FAILED_VALIDATION'
      });
      return {
        success: false,
        outboundContext: undefined,
        diagnostics: {
          status: 'FAILED_VALIDATION',
          detectionsCount: 0,
          blockedCount: 0,
          maskedCount: 0,
          allowedCount: 0,
          validationErrors: ['Invalid or malformed BrowserContext supplied to pipeline'],
          timestamp
        }
      };
    }

    // 1. Detect sensitive data
    const detections = detectSensitiveData(context);

    // 2. Sanitize context (evaluates policy internally per element)
    const sanitized = sanitizeContext(context, detections);

    // 3. Apply task-conditioned minimum disclosure
    const disclosed = applyMinimumDisclosure(sanitized, context.taskInstruction);

    // 4. Independent outbound validation
    const validation = validateOutboundContext(disclosed);

    const blockedCount = disclosed.elements.filter(e => e.decision === 'BLOCK').length;
    const maskedCount = disclosed.elements.filter(e => e.decision === 'MASK').length;
    const allowedCount = disclosed.elements.filter(e => e.decision === 'ALLOW').length;

    if (!validation.isValid) {
      safeLogger.log({
        decision: 'BLOCK',
        reason: 'Outbound validator rejected payload',
        count: validation.errors?.length,
        status: 'FAILED_VALIDATION'
      });

      // Fail closed: Never return unsafe outbound payload
      return {
        success: false,
        outboundContext: undefined,
        diagnostics: {
          status: 'FAILED_VALIDATION',
          detectionsCount: detections.length,
          blockedCount,
          maskedCount,
          allowedCount,
          validationErrors: validation.errors,
          timestamp: Date.now()
        }
      };
    }

    safeLogger.log({
      status: 'SUCCESS',
      reason: 'Context safely sanitized and validated for outbound transmission',
      count: disclosed.elements.length
    });

    return {
      success: true,
      outboundContext: validation.context,
      diagnostics: {
        status: 'SUCCESS',
        detectionsCount: detections.length,
        blockedCount,
        maskedCount,
        allowedCount,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    // Fail closed on any unexpected pipeline error
    const safeErrorMessage = error instanceof Error ? error.message : 'Unknown internal error';
    safeLogger.log({
      decision: 'BLOCK',
      reason: `Pipeline failed closed: ${safeErrorMessage}`,
      status: 'FAILED_VALIDATION'
    });

    return {
      success: false,
      outboundContext: undefined,
      diagnostics: {
        status: 'FAILED_VALIDATION',
        detectionsCount: 0,
        blockedCount: 0,
        maskedCount: 0,
        allowedCount: 0,
        validationErrors: ['Pipeline execution failed closed due to an internal exception'],
        timestamp: Date.now()
      }
    };
  }
}
