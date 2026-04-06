import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { HeliusService } from '../services/helius.service';
import { JupiterService } from '../services/jupiter.service';
import { KaminoService } from '../services/kamino.service';
import { DriftService } from '../services/drift.service';
import { MarginfiService } from '../services/marginfi.service';
import { buildPortfolioSnapshot } from '../reasoning/context-builder';
import { analyzePortfolio } from '../reasoning/engine';
import type {
  TokenBalance,
  Position,
  PriceData,
  PortfolioSnapshot,
  ReasoningResult,
} from '../types/index';

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

async function validate(
  _runtime: IAgentRuntime,
  message: Memory,
): Promise<boolean> {
  const text = (message.content?.text ?? '').toLowerCase();
  return (
    text.includes('portfolio') ||
    text.includes('position') ||
    text.includes('health') ||
    text.includes('risk') ||
    text.includes('how am i') ||
    text.includes("how's my") ||
    text.includes('analyze')
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
): Promise<
  | { success: true; data: { snapshot: PortfolioSnapshot; result: ReasoningResult } }
  | { success: false; error: string }
> {
  const walletAddress = runtime.getSetting('WALLET_ADDRESS');
  const heliusApiKey = runtime.getSetting('HELIUS_API_KEY');

  if (!walletAddress || !heliusApiKey) {
    const error = 'Wallet not configured. Set WALLET_ADDRESS and HELIUS_API_KEY.';
    await callback?.({ text: error });
    return { success: false, error };
  }

  // Emit progress before the heavy parallel fetches
  await callback?.({ text: 'Analyzing your portfolio...' });

  const walletStr = walletAddress as string;
  const heliusStr = heliusApiKey as string;

  // Instantiate services
  const helius = new HeliusService(heliusStr);
  const jupiter = new JupiterService();
  const kamino = new KaminoService(heliusStr);
  const drift = new DriftService(heliusStr);
  const marginfi = new MarginfiService(heliusStr);

  // Step 1: parallel fetch — token balances + protocol positions
  const [tokens, kaminoPositions, driftPositions, marginfiPositions] =
    await Promise.all([
      helius.getAssetsByOwner(walletStr),
      kamino.getPositions(walletStr).catch((): Position[] => []),
      drift.getPositions(walletStr).catch((): Position[] => []),
      marginfi.getPositions(walletStr).catch((): Position[] => []),
    ]);

  const positions: Position[] = [
    ...kaminoPositions,
    ...driftPositions,
    ...marginfiPositions,
  ];

  // Step 2: fetch prices from Jupiter for all token mints in the wallet
  const mints = tokens.map((t: TokenBalance) => t.mint);
  let priceMap = new Map<string, number>();

  try {
    if (mints.length > 0) {
      priceMap = await jupiter.getPrices(mints);
    }
  } catch {
    // Price data failure is non-fatal — proceed with empty price context
  }

  // Convert Jupiter's Map<mint, number> → PriceData[] for context-builder.
  // change24h is not available from the price endpoint in Phase 1 (no OHLCV);
  // defaulted to 0 so volatility/trend classification falls through to 'low'/'neutral'.
  const prices: PriceData[] = Array.from(priceMap.entries()).map(
    ([mint, price]) => ({
      mint,
      symbol: tokens.find((t: TokenBalance) => t.mint === mint)?.symbol ?? mint,
      price,
      change24h: 0,
    }),
  );

  // Step 3: build snapshot
  const snapshot = buildPortfolioSnapshot(tokens, positions, prices);

  // Step 4: run reasoning engine
  const result = analyzePortfolio(snapshot);

  // Step 5: format and emit final output
  const riskLines =
    result.risks.length === 0
      ? '  No significant risks detected.'
      : result.risks
          .map((r) => `  [${r.severity.toUpperCase()}] ${r.description}`)
          .join('\n');

  const output = [
    '=== Portfolio Analysis ===',
    result.analysis,
    '',
    'Risks:',
    riskLines,
    '',
    `Recommendation: ${result.recommendation.action}`,
    `Reasoning: ${result.recommendation.reasoning}`,
    `Confidence: ${result.recommendation.confidence}`,
  ].join('\n');

  await callback?.({ text: output });

  return { success: true, data: { snapshot, result } };
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const examples = [
  [
    {
      name: 'user',
      content: { text: 'How is my portfolio doing?' },
    },
    {
      name: 'agent',
      content: {
        text: 'Analyzing your portfolio...',
        action: 'ANALYZE_PORTFOLIO',
      },
    },
  ],
  [
    {
      name: 'user',
      content: { text: 'Check my DeFi positions and risk' },
    },
    {
      name: 'agent',
      content: {
        text: '=== Portfolio Analysis ===\nPortfolio value: $5,000...',
        action: 'ANALYZE_PORTFOLIO',
      },
    },
  ],
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const analyzePortfolioAction: Action = {
  name: 'ANALYZE_PORTFOLIO',
  similes: ['PORTFOLIO', 'ANALYSIS', 'HEALTH', 'RISK_CHECK', 'HOW_AM_I_DOING'],
  description: 'Analyze portfolio across all DeFi positions with risk assessment',
  validate,
  handler,
  examples,
};
