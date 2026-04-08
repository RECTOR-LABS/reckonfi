import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

// ---------------------------------------------------------------------------
// Module-level wallet override state
// ---------------------------------------------------------------------------

let walletOverride: string | null = null;

export function getWalletOverride(): string | null {
  return walletOverride;
}

export function setWalletOverride(address: string): void {
  walletOverride = address;
}

// ---------------------------------------------------------------------------
// Solana address regex — base58, 32-44 chars (excludes 0, O, I, l)
// ---------------------------------------------------------------------------

const SOLANA_ADDRESS_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

function extractSolanaAddress(text: string): string | null {
  const matches = text.match(SOLANA_ADDRESS_RE);
  if (!matches) return null;

  // Return the first match that sits within valid Solana address length bounds.
  // The regex already enforces 32-44, but guard against partial-word false positives
  // by ensuring the match isn't surrounded by alphanumeric chars that extend it.
  for (const match of matches) {
    const idx = text.indexOf(match);
    const before = idx > 0 ? text[idx - 1] : ' ';
    const after = idx + match.length < text.length ? text[idx + match.length] : ' ';
    const isBoundaryChar = (c: string) => /[^1-9A-HJ-NP-Za-km-z]/.test(c);
    if (isBoundaryChar(before) && isBoundaryChar(after)) {
      return match;
    }
  }

  return matches[0] ?? null;
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

async function validate(
  _runtime: IAgentRuntime,
  message: Memory,
): Promise<boolean> {
  const text = (message.content?.text ?? '').toLowerCase();
  const containsKeyword =
    text.includes('use wallet') ||
    text.includes('set wallet') ||
    text.includes('switch wallet') ||
    text.includes('monitor wallet');

  if (containsKeyword) return true;

  // Also trigger if the message text contains a standalone Solana address
  const raw = message.content?.text ?? '';
  return extractSolanaAddress(raw) !== null;
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
): Promise<{ success: true; data: { walletAddress: string } } | { success: false; error: string }> {
  const text = message.content?.text ?? '';
  const address = extractSolanaAddress(text);

  if (!address) {
    const error = 'Please provide a Solana wallet address. Example: use wallet FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';
    await callback?.({ text: error });
    return { success: false, error };
  }

  // Store in module-level override so providers can read it at request time
  setWalletOverride(address);

  const responseText = `Now monitoring wallet ${address}. Ask me to check your balance or analyze your portfolio.`;
  await callback?.({ text: responseText });

  return { success: true, data: { walletAddress: address } };
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const examples = [
  [
    {
      name: 'user',
      content: { text: 'Use wallet FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' },
    },
    {
      name: 'agent',
      content: {
        text: 'Now monitoring wallet FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr. Ask me to check your balance or analyze your portfolio.',
        action: 'SET_WALLET',
      },
    },
  ],
  [
    {
      name: 'user',
      content: { text: 'Switch wallet to 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' },
    },
    {
      name: 'agent',
      content: {
        text: 'Now monitoring wallet 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM. Ask me to check your balance or analyze your portfolio.',
        action: 'SET_WALLET',
      },
    },
  ],
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const setWalletAction: Action = {
  name: 'SET_WALLET',
  similes: ['WALLET_ADDRESS', 'USE_WALLET', 'SWITCH_WALLET', 'MONITOR_WALLET'],
  description: 'Set or change the wallet address to monitor',
  validate,
  handler,
  examples,
};
