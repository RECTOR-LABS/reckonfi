import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { JupiterService } from '../services/jupiter.service';
import type { SwapQuote } from '../types/index';

// ---------------------------------------------------------------------------
// Token registry
// ---------------------------------------------------------------------------

const TOKEN_MAP: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
};

/** Default slippage tolerance: 50 bps = 0.5% */
const DEFAULT_SLIPPAGE_BPS = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwapIntent {
  amount: number;
  fromSymbol: string;
  toSymbol: string;
  fromMint: string;
  toMint: string;
}

// ---------------------------------------------------------------------------
// parseSwapIntent
// ---------------------------------------------------------------------------

/**
 * Extracts swap intent from natural-language text.
 *
 * Matches patterns like:
 *   "swap 1 SOL to USDC"
 *   "convert 0.5 SOL for USDT"
 *   "exchange 2 USDC into SOL"
 *
 * Returns null if the pattern doesn't match or either token is unknown.
 */
export function parseSwapIntent(text: string): SwapIntent | null {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i,
  );

  if (!match) return null;

  const amount = parseFloat(match[1]!);
  const fromSymbol = match[2]!.toUpperCase();
  const toSymbol = match[3]!.toUpperCase();

  const fromMint = TOKEN_MAP[fromSymbol];
  const toMint = TOKEN_MAP[toSymbol];

  if (!fromMint || !toMint) return null;

  return { amount, fromSymbol, toSymbol, fromMint, toMint };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRawAmount(amount: number, symbol: string): number {
  const decimals = TOKEN_DECIMALS[symbol] ?? 9;
  return Math.round(amount * 10 ** decimals);
}

function formatSwapPlan(
  intent: SwapIntent,
  quote: SwapQuote,
): string {
  const outputDecimals = TOKEN_DECIMALS[intent.toSymbol] ?? 6;
  const outputHuman = quote.outputAmount / 10 ** outputDecimals;

  const lines: string[] = [
    'Swap Plan',
    '─────────────────────────────────────────',
    `From:          ${intent.amount} ${intent.fromSymbol}`,
    `To:            ~${outputHuman.toFixed(4)} ${intent.toSymbol}`,
    `Route:         ${quote.route}`,
    `Price Impact:  ${(quote.priceImpact * 100).toFixed(4)}%`,
    `Slippage:      ${(quote.slippage * 100).toFixed(2)}%`,
    '─────────────────────────────────────────',
    "Reply 'confirm' to execute or 'cancel' to abort.",
  ];

  return lines.join('\n');
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
    text.includes('swap') ||
    text.includes('convert') ||
    text.includes('exchange') ||
    text.includes('trade') ||
    text.includes('move to stable')
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type SwapHandlerResult =
  | { success: true; data: { quote: SwapQuote; fromSymbol: string; toSymbol: string; outputAmount: number; awaitingConfirmation: true } }
  | { success: false; error: string };

async function handler(
  _runtime: IAgentRuntime,
  message: Memory,
  _state?: State,
  _options?: Record<string, unknown>,
  callback?: HandlerCallback,
): Promise<SwapHandlerResult> {
  const text = message.content?.text ?? '';

  // Step 1 — parse intent
  const intent = parseSwapIntent(text);

  if (!intent) {
    const errorText =
      "I need more details to execute this swap. Please specify the amount and tokens, e.g. 'swap 1 SOL to USDC'.";
    await callback?.({ text: errorText });
    return { success: false, error: errorText };
  }

  // Step 2 — fetch Jupiter quote
  let quote: SwapQuote;

  try {
    const jupiter = new JupiterService();
    const rawAmount = toRawAmount(intent.amount, intent.fromSymbol);
    quote = await jupiter.getQuote(
      intent.fromMint,
      intent.toMint,
      rawAmount,
      DEFAULT_SLIPPAGE_BPS,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorText = `Failed to get swap quote: ${message}`;
    await callback?.({ text: errorText });
    return { success: false, error: errorText };
  }

  // Step 3 — format and present swap plan
  const planText = formatSwapPlan(intent, quote);
  await callback?.({ text: planText });

  const outputDecimals = TOKEN_DECIMALS[intent.toSymbol] ?? 6;
  const outputAmount = quote.outputAmount / 10 ** outputDecimals;

  return {
    success: true,
    data: {
      quote,
      fromSymbol: intent.fromSymbol,
      toSymbol: intent.toSymbol,
      outputAmount,
      awaitingConfirmation: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const examples = [
  [
    {
      name: 'user',
      content: { text: 'swap 1 SOL to USDC' },
    },
    {
      name: 'agent',
      content: {
        text: "Swap Plan\n─────────\nFrom: 1 SOL\nTo: ~140.0000 USDC\nRoute: Orca\nPrice Impact: 0.0100%\nSlippage: 0.50%\nReply 'confirm' to execute or 'cancel' to abort.",
        action: 'SWAP_TOKENS',
      },
    },
  ],
  [
    {
      name: 'user',
      content: { text: 'convert 500 USDC into SOL' },
    },
    {
      name: 'agent',
      content: {
        text: "Swap Plan\n─────────\nFrom: 500 USDC\nTo: ~3.5714 SOL\nRoute: Orca\nReply 'confirm' to execute or 'cancel' to abort.",
        action: 'SWAP_TOKENS',
      },
    },
  ],
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const swapTokensAction: Action = {
  name: 'SWAP_TOKENS',
  similes: ['SWAP', 'EXCHANGE', 'CONVERT', 'TRADE', 'MOVE_TO_STABLES'],
  description: 'Swap tokens via Jupiter with confirmation flow',
  validate,
  handler,
  examples,
};
