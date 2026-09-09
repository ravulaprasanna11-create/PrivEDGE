/**
 * PRIVEDGE Phase 6 — Cloud Reasoning Provider Interface & Implementations
 * SIH26171: Privacy-Preserving Browser Agent
 *
 * Provides the provider abstraction:
 * 1. CloudReasoningProvider (HTTP fetch to configured cloud LLM/VLM)
 * 2. MockReasoningProvider (Deterministic in-memory provider for automated tests)
 *
 * INVARIANT: Never accepts or transmits raw DOM, raw screenshot, raw PII, or tokens.
 */

import type {
  ReasoningProvider,
  SafeReasoningContext,
  ProviderReasoningResult
} from '../types/reasoning';
import { SYSTEM_PROMPT, buildReasoningPrompt } from './prompt';

/**
 * Production Cloud Reasoning Provider using native HTTP fetch.
 * Works with any OpenAI-compatible API or standard chat completion endpoint.
 */
export class CloudReasoningProvider implements ReasoningProvider {
  readonly name: string;
  private readonly apiKey: string | undefined;
  private readonly modelName: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env['MODEL_API_KEY'] || process.env['REASONING_API_KEY'];
    this.modelName = process.env['MODEL_NAME'] || process.env['REASONING_MODEL'] || 'gpt-4o-mini';
    this.baseUrl = (process.env['MODEL_BASE_URL'] || process.env['REASONING_BASE_URL'] || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.name = `CloudReasoningProvider(${this.modelName})`;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0;
  }

  async reason(context: SafeReasoningContext): Promise<ProviderReasoningResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Reasoning provider not configured: MODEL_API_KEY is missing.',
      };
    }

    const start = Date.now();
    const prompt = buildReasoningPrompt(context);

    try {
      const endpoint = `${this.baseUrl}/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature: 0.1,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });

      const durationMs = Date.now() - start;

      if (!response.ok) {
        return {
          success: false,
          error: `Provider HTTP error: status ${response.status}`,
          durationMs,
        };
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;

      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Provider returned an empty response.',
          durationMs,
        };
      }

      return {
        success: true,
        rawText: content,
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: `Provider call failed: ${(err as Error).message}`,
        durationMs: Date.now() - start,
      };
    }
  }
}

/**
 * Deterministic Mock Provider for unit testing and CI without external network access or API keys.
 */
export class MockReasoningProvider implements ReasoningProvider {
  readonly name = 'MockReasoningProvider';
  private configured = true;
  private responseHandler?: (context: SafeReasoningContext) => string | Error;

  constructor(handler?: (context: SafeReasoningContext) => string | Error) {
    this.responseHandler = handler;
  }

  setConfigured(status: boolean): void {
    this.configured = status;
  }

  setHandler(handler: (context: SafeReasoningContext) => string | Error): void {
    this.responseHandler = handler;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async reason(context: SafeReasoningContext): Promise<ProviderReasoningResult> {
    if (!this.configured) {
      return {
        success: false,
        error: 'Reasoning provider not configured: MODEL_API_KEY is missing.',
      };
    }

    const start = Date.now();

    if (this.responseHandler) {
      try {
        const result = this.responseHandler(context);
        if (result instanceof Error) {
          return {
            success: false,
            error: result.message,
            durationMs: Date.now() - start,
          };
        }
        return {
          success: true,
          rawText: result,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          success: false,
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    }

    // Default deterministic proposal based on context
    const firstInteractive = context.elements.find(e => e.isInteractive && e.decision === 'ALLOW');
    const defaultOutput = firstInteractive && firstInteractive.id
      ? JSON.stringify({
          action: 'click',
          targetElementId: firstInteractive.id,
          reason: `Interacting with visible safe target ${firstInteractive.id}`,
          confidence: 0.95,
        })
      : JSON.stringify({
          action: 'none',
          reason: 'No safe actionable target was identified.',
          confidence: 0,
        });

    return {
      success: true,
      rawText: defaultOutput,
      durationMs: Date.now() - start,
    };
  }
}
