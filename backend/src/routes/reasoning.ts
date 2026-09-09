/**
 * PRIVEDGE Phase 6 — Reasoning Route
 * POST /api/reason — invoke reasoning over stored sanitized context.
 *
 * DOES NOT accept raw browser context.
 * Retrieves safe context from SQLite, invokes reasoning provider, validates
 * structured output, and stores proposal as PENDING in actions table.
 */

import { Router } from 'express';
import type { ReasonApiRequest, ReasonApiResponse } from '../types/reasoning';
import { executeReasoning } from '../reasoning/service';

export const reasoningRouter: Router = Router();

reasoningRouter.post('/', async (req, res) => {
  const body = req.body as Partial<ReasonApiRequest>;

  if (!body || typeof body !== 'object') {
    res.status(400).json({ success: false, error: 'Request body required.' });
    return;
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    res.status(400).json({ success: false, error: 'sessionId required.' });
    return;
  }

  if (!body.userGoal || typeof body.userGoal !== 'string' || !body.userGoal.trim()) {
    res.status(400).json({ success: false, error: 'userGoal required.' });
    return;
  }

  try {
    const result = await executeReasoning({
      sessionId: body.sessionId,
      taskId: body.taskId,
      userGoal: body.userGoal,
    });

    if (!result.success) {
      // Return 400 for input/validation/context errors, 503 for unconfigured/provider errors
      const isConfigOrProviderError =
        result.error?.includes('not configured') ||
        result.error?.includes('Provider') ||
        result.error?.includes('provider');
      const statusCode = result.error === 'Session not found.' || result.error === 'Task not found.' || result.error?.includes('not found')
        ? 404
        : isConfigOrProviderError
          ? 503
          : 400;

      const response: ReasonApiResponse = {
        success: false,
        error: result.error,
        data: {
          proposal: result.proposal,
          status: 'none',
          stored: false,
          provider: result.provider,
          durationMs: result.durationMs,
        },
      };
      res.status(statusCode).json(response);
      return;
    }

    const response: ReasonApiResponse = {
      success: true,
      data: {
        proposal: result.proposal,
        actionId: result.actionId,
        status: result.status,
        stored: result.stored,
        provider: result.provider,
        durationMs: result.durationMs,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    // Fail closed, no sensitive leak
    res.status(500).json({ success: false, error: 'Internal reasoning error.' });
  }
});
