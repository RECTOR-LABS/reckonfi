import type { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import type { Decision } from '../types/index';

// ---------------------------------------------------------------------------
// Classification keywords
// ---------------------------------------------------------------------------

const CONFIRM_SIGNALS = ['confirm', 'yes', 'do it'];
const REJECT_SIGNALS = ['cancel', 'no', 'skip'];

const MAX_DECISIONS = 100;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let decisions: Decision[] = [];

/** Returns a snapshot of all recorded decisions. */
export function getDecisions(): Decision[] {
  return [...decisions];
}

/** Resets decision history. Intended for testing. */
export function clearDecisions(): void {
  decisions = [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function containsAny(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  return signals.some((s) => lower.includes(s));
}

function classifyUserAction(text: string): string | null {
  if (containsAny(text, CONFIRM_SIGNALS)) return 'confirmed';
  if (containsAny(text, REJECT_SIGNALS)) return 'rejected';
  return null;
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
  const userAction = classifyUserAction(text);

  // Only record messages that map to a clear decision signal
  if (userAction === null) return;

  const decision: Decision = {
    timestamp: Date.now(),
    recommendation: '',
    userAction,
    outcome: null,
  };

  decisions.push(decision);

  // Keep last 100 decisions
  if (decisions.length > MAX_DECISIONS) {
    decisions = decisions.slice(decisions.length - MAX_DECISIONS);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const decisionTrackerEvaluator: Evaluator = {
  name: 'DECISION_TRACKER',
  alwaysRun: true,
  description: 'Records user confirm/reject decisions for portfolio recommendation tracking',
  similes: [],
  examples: [],
  validate,
  handler,
};
