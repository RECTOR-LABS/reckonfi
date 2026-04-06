import type { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import type { RiskProfile, RiskTolerance } from '../types/index';

// ---------------------------------------------------------------------------
// Conservative / aggressive keyword sets
// ---------------------------------------------------------------------------

const CONSERVATIVE_SIGNALS = ['reduce', 'collateral', 'deleverage', 'safe', 'stables', 'protect'];
const AGGRESSIVE_SIGNALS = ['lever', 'long', 'short', 'yolo', 'max', 'ape'];

const MAX_HISTORY = 50;
const MIN_ACTIONS_FOR_CLASSIFICATION = 5;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let historicalActions: string[] = [];
let currentTolerance: RiskTolerance = 'moderate';

/** Returns a snapshot of the current risk profile. */
export function getRiskProfile(): RiskProfile {
  return {
    tolerance: currentTolerance,
    avgLeverage: 0,
    historicalActions: [...historicalActions],
  };
}

/** Resets all evaluator state. Intended for testing. */
export function clearRiskProfilerState(): void {
  historicalActions = [];
  currentTolerance = 'moderate';
}

// ---------------------------------------------------------------------------
// Signal counting
// ---------------------------------------------------------------------------

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.reduce((count, signal) => count + (lower.includes(signal) ? 1 : 0), 0);
}

function classifyTolerance(actions: string[]): RiskTolerance {
  if (actions.length < MIN_ACTIONS_FOR_CLASSIFICATION) {
    return 'moderate';
  }

  let conservativeCount = 0;
  let aggressiveCount = 0;

  for (const action of actions) {
    conservativeCount += countSignals(action, CONSERVATIVE_SIGNALS);
    aggressiveCount += countSignals(action, AGGRESSIVE_SIGNALS);
  }

  // ratio = conservative / (conservative + aggressive + 1) to avoid division by zero
  const ratio = conservativeCount / (conservativeCount + aggressiveCount + 1);

  if (ratio > 0.6) return 'conservative';
  if (ratio < 0.3) return 'aggressive';
  return 'moderate';
}

// ---------------------------------------------------------------------------
// Validate — always runs
// ---------------------------------------------------------------------------

async function validate(
  _runtime: IAgentRuntime,
  _message: Memory,
): Promise<boolean> {
  return true;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(
  _runtime: IAgentRuntime,
  message: Memory,
  _state?: State,
): Promise<void> {
  const text = message.content?.text ?? '';

  // Record action, keep last 50
  historicalActions.push(text);
  if (historicalActions.length > MAX_HISTORY) {
    historicalActions = historicalActions.slice(historicalActions.length - MAX_HISTORY);
  }

  // Re-classify tolerance based on updated history
  currentTolerance = classifyTolerance(historicalActions);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const riskProfilerEvaluator: Evaluator = {
  name: 'RISK_PROFILER',
  alwaysRun: true,
  description: 'Tracks user message history to infer risk tolerance profile',
  similes: [],
  examples: [],
  validate,
  handler,
};
