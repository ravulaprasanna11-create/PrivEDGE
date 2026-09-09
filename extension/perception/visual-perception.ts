/**
 * PRIVEDGE Phase 3: Browser Extension - Visual Perception Adapter
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Adapter connecting Phase 2 captured visible-tab screenshots
 * to the Phase 3 on-device visual perception pipeline.
 */

import type { CapturedScreen } from '../shared/types';
import type { VisualContext } from '../../lib/perception/types';
import { processVisualPerception } from '../../lib/perception/processor';

/**
 * Runs local on-device visual perception on a Phase 2 CapturedScreen.
 */
export async function runVisualPerceptionOnScreen(
  screen?: CapturedScreen | null
): Promise<VisualContext> {
  if (!screen || !screen.dataUrl) {
    throw new Error('Visual perception failed: No valid screenshot provided by extension capture');
  }

  const result = await processVisualPerception({
    dataUrl: screen.dataUrl,
    width: screen.width,
    height: screen.height,
    timestamp: screen.timestamp
  });

  return result;
}
