import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

async function validate(
  _runtime: IAgentRuntime,
  message: Memory,
): Promise<boolean> {
  const text = (message.content?.text ?? '').toLowerCase();
  return text.includes('monitor') || text.includes('track position');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(
  _runtime: IAgentRuntime,
  _message: Memory,
  _state?: State,
  _options?: Record<string, unknown>,
  callback?: HandlerCallback,
): Promise<{ success: true; data: { status: 'not_yet_active' } }> {
  await callback?.({
    text: 'Position monitoring is coming in a future update. Stay tuned!',
  });

  return { success: true, data: { status: 'not_yet_active' } };
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const examples = [
  [
    {
      name: 'user',
      content: { text: 'Monitor my SOL position' },
    },
    {
      name: 'agent',
      content: {
        text: 'Position monitoring is coming in a future update. Stay tuned!',
        action: 'MONITOR_POSITION',
      },
    },
  ],
  [
    {
      name: 'user',
      content: { text: 'Track position on my Kamino lending' },
    },
    {
      name: 'agent',
      content: {
        text: 'Position monitoring is coming in a future update. Stay tuned!',
        action: 'MONITOR_POSITION',
      },
    },
  ],
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const monitorPositionAction: Action = {
  name: 'MONITOR_POSITION',
  similes: ['MONITOR', 'TRACK_POSITION', 'WATCH_POSITION'],
  description: 'Monitor a DeFi position for changes (coming soon)',
  validate,
  handler,
  examples,
};
