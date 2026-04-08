import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { HeliusService } from '../services/helius.service';
import type { TokenBalance } from '../types/index';

const TOP_TOKENS_LIMIT = 15;

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

async function validate(
  _runtime: IAgentRuntime,
  message: Memory,
): Promise<boolean> {
  const text = (message.content?.text ?? '').toLowerCase();
  return (
    text.includes('balance') ||
    text.includes('wallet') ||
    text.includes('holdings') ||
    text.includes('how much')
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(
  runtime: IAgentRuntime,
  _message: Memory,
  _state?: State,
  _options?: Record<string, unknown>,
  callback?: HandlerCallback,
): Promise<{ success: true; data: { tokens: TokenBalance[]; totalUSD: number } } | { success: false; error: string }> {
  const walletAddress = String(runtime.getSetting('WALLET_ADDRESS') ?? '');
  const heliusApiKey = String(runtime.getSetting('HELIUS_API_KEY') ?? '');

  if (!walletAddress || !heliusApiKey) {
    const error = 'Wallet not configured. Set WALLET_ADDRESS and HELIUS_API_KEY.';
    await callback?.({ text: error });
    return { success: false, error };
  }

  let allTokens: TokenBalance[];

  try {
    const helius = new HeliusService(heliusApiKey as string);
    allTokens = await helius.getAssetsByOwner(walletAddress as string);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error = `Failed to fetch wallet balance: ${message}`;
    await callback?.({ text: error });
    return { success: false, error };
  }

  // Sort by usdValue descending and take top 15
  const tokens = [...allTokens]
    .sort((a, b) => b.usdValue - a.usdValue)
    .slice(0, TOP_TOKENS_LIMIT);

  // totalUSD reflects ALL tokens, not just the displayed top 15
  const totalUSD = allTokens.reduce((sum, t) => sum + t.usdValue, 0);

  const tokenLines = tokens
    .map((t) => `  ${t.symbol}: ${t.amount.toFixed(4)} ($${t.usdValue.toFixed(2)})`)
    .join('\n');

  const text = [
    `Wallet: ${walletAddress}`,
    `Total Value: $${totalUSD.toFixed(2)}`,
    'Top Holdings:',
    tokenLines,
  ].join('\n');

  await callback?.({ text });

  return { success: true, data: { tokens, totalUSD } };
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const examples = [
  [
    {
      name: 'user',
      content: { text: "What's my balance?" },
    },
    {
      name: 'agent',
      content: {
        text: 'Wallet: FGSkt...\nTotal Value: $2,350.00\nTop Holdings:\n  SOL: 10.0000 ($1,850.00)\n  USDC: 500.0000 ($500.00)',
        action: 'CHECK_BALANCE',
      },
    },
  ],
  [
    {
      name: 'user',
      content: { text: 'Show me my wallet holdings' },
    },
    {
      name: 'agent',
      content: {
        text: 'Fetching your wallet balance...',
        action: 'CHECK_BALANCE',
      },
    },
  ],
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const checkBalanceAction: Action = {
  name: 'CHECK_BALANCE',
  similes: ['BALANCE', 'WALLET', 'HOLDINGS', 'PORTFOLIO_BALANCE'],
  description: 'Check wallet balance and token holdings',
  validate,
  handler,
  examples,
};
