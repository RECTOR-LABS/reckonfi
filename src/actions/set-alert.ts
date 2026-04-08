import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import type { Alert } from '../types/index';

// ---------------------------------------------------------------------------
// Module-level in-memory alert store
// ---------------------------------------------------------------------------

const alertStore: Alert[] = [];

/** Returns a copy of all stored alerts. */
export function getAlerts(): Alert[] {
  return [...alertStore];
}

/** Clears all stored alerts. Intended for testing. */
export function clearAlerts(): void {
  alertStore.length = 0;
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

async function validate(
  _runtime: IAgentRuntime,
  message: Memory,
): Promise<boolean> {
  const text = (message.content?.text ?? '').toLowerCase();
  return (
    text.includes('alert') ||
    text.includes('notify') ||
    text.includes('warn') ||
    text.includes('watch')
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(
  _runtime: IAgentRuntime,
  message: Memory,
  _state?: State,
  _options?: Record<string, unknown>,
  callback?: HandlerCallback,
): Promise<{ success: true; data: { alert: Alert } }> {
  const text = message.content?.text ?? '';

  const alert: Alert = {
    id: `alert-${Date.now()}`,
    type: 'price',
    severity: 'info',
    message: text,
    position: null,
    createdAt: Date.now(),
    acknowledged: false,
  };

  alertStore.push(alert);

  const responseText = [
    `Alert set: "${text}"`,
    `Alert ID: ${alert.id}`,
    'Note: Alerts are stored in memory only and will be cleared on agent restart.',
  ].join('\n');

  await callback?.({ text: responseText });

  return { success: true, data: { alert } };
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const examples = [
  [
    {
      name: 'user',
      content: { text: 'Alert me when SOL drops to $100' },
    },
    {
      name: 'agent',
      content: {
        text: 'Alert set: "Alert me when SOL drops to $100"\nAlert ID: alert-123456\nNote: Alerts are stored in memory only and will be cleared on agent restart.',
        action: 'SET_ALERT',
      },
    },
  ],
  [
    {
      name: 'user',
      content: { text: 'Notify me if my health factor drops below 1.5' },
    },
    {
      name: 'agent',
      content: {
        text: 'Alert set: "Notify me if my health factor drops below 1.5"\nAlert ID: alert-123457\nNote: Alerts are stored in memory only and will be cleared on agent restart.',
        action: 'SET_ALERT',
      },
    },
  ],
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const setAlertAction: Action = {
  name: 'SET_ALERT',
  similes: ['ALERT', 'NOTIFY', 'WARN_ME', 'WATCH'],
  description: 'Set a price or health alert for monitoring positions',
  validate,
  handler,
  examples,
};
