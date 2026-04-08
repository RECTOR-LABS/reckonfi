import type { ExecutionStep, PortfolioSnapshot, TokenBalance } from '../types/index';
import { JupiterService } from '../services/jupiter.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const STABLECOIN_MINTS = new Set([USDC_MINT, USDT_MINT]);

/**
 * Jupiter slippage tolerance in basis points (50 bps = 0.5%).
 */
const SWAP_SLIPPAGE_BPS = 50;

/**
 * Estimated on-chain cost per swap step in SOL.
 */
const COST_PER_STEP_SOL = 0.005;

/**
 * Minimum USD value for a token to be eligible for swapping (dust filter).
 */
const MIN_USD_VALUE = 1;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExecutionPlan {
  steps: ExecutionStep[];
  estimatedCost: number;
  slippageImpact: number;
}

// ---------------------------------------------------------------------------
// Intent patterns
// ---------------------------------------------------------------------------

// Capture group 1 = token symbol for take-profit pattern
const TAKE_PROFIT_PATTERN = /take\s+profit\s+(?:on\s+)?(\w+)/i;

const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  handler: (snapshot: PortfolioSnapshot, jupiter: JupiterService, match: RegExpMatchArray) => Promise<ExecutionPlan>;
}> = [
  {
    pattern: /move\s+to\s+stables?/i,
    handler: (snapshot, jupiter) => moveToStables(snapshot, jupiter),
  },
  {
    pattern: /reduce\s+risk/i,
    handler: (snapshot, jupiter) => reduceRisk(snapshot, jupiter),
  },
  {
    pattern: TAKE_PROFIT_PATTERN,
    handler: (snapshot, jupiter, match) => takeProfit(snapshot, jupiter, match[1] ?? ''),
  },
  {
    pattern: /rebalance/i,
    handler: (snapshot) => rebalance(snapshot),
  },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Resolve a natural-language intent into an ExecutionPlan.
 *
 * Returns null for unrecognized intents.
 * The first matching pattern wins.
 */
export async function resolveIntent(
  intent: string,
  snapshot: PortfolioSnapshot
): Promise<ExecutionPlan | null> {
  const jupiter = new JupiterService();

  for (const { pattern, handler } of INTENT_PATTERNS) {
    const match = intent.match(pattern);
    if (match) {
      return handler(snapshot, jupiter, match);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Handler: moveToStables
// ---------------------------------------------------------------------------

/**
 * Convert all non-stablecoin wallet tokens (usdValue > 1) to USDC via Jupiter.
 *
 * Decimal convention:
 *   - SOL  → 9 decimals
 *   - All other tokens → 6 decimals
 *
 * On quote failure the step is still added with a retry note so execution
 * can proceed with the remaining steps.
 */
async function moveToStables(
  snapshot: PortfolioSnapshot,
  jupiter: JupiterService
): Promise<ExecutionPlan> {
  const nonStableTokens = snapshot.wallet.tokens.filter(
    (t) => !STABLECOIN_MINTS.has(t.mint) && t.usdValue > MIN_USD_VALUE
  );

  const steps: ExecutionStep[] = [];
  let totalPriceImpact = 0;

  for (const token of nonStableTokens) {
    const rawAmount = toRawAmount(token);

    let stepParams: Record<string, unknown>;

    try {
      const quote = await jupiter.getQuote(token.mint, USDC_MINT, rawAmount, SWAP_SLIPPAGE_BPS);
      totalPriceImpact += quote.priceImpact;
      stepParams = {
        inputMint: token.mint,
        outputMint: USDC_MINT,
        amount: rawAmount,
        route: quote.route,
        expectedOutputAmount: quote.outputAmount,
      };
    } catch {
      stepParams = {
        inputMint: token.mint,
        outputMint: USDC_MINT,
        amount: rawAmount,
        note: 'quote failed — retry at execution',
      };
    }

    steps.push({
      action: 'swap',
      description: `Swap ${token.amount} ${token.symbol} to USDC`,
      params: stepParams,
    });
  }

  return {
    steps,
    estimatedCost: COST_PER_STEP_SOL * steps.length,
    slippageImpact: totalPriceImpact,
  };
}

// ---------------------------------------------------------------------------
// Handler: reduceRisk
// ---------------------------------------------------------------------------

/**
 * Identify positions with healthFactor < 1.5 and build add_collateral steps,
 * sorted ascending by healthFactor (most critical first).
 */
async function reduceRisk(
  snapshot: PortfolioSnapshot,
  _jupiter: JupiterService
): Promise<ExecutionPlan> {
  const riskyPositions = snapshot.positions
    .filter((p) => p.healthFactor !== null && p.healthFactor < 1.5)
    .sort((a, b) => (a.healthFactor as number) - (b.healthFactor as number));

  const steps: ExecutionStep[] = riskyPositions.map((position) => ({
    action: 'add_collateral',
    description:
      `Add collateral to ${position.protocol} ${position.type} position ` +
      `(healthFactor: ${position.healthFactor})`,
    params: {
      protocol: position.protocol,
      positionType: position.type,
      healthFactor: position.healthFactor,
    },
  }));

  return {
    steps,
    estimatedCost: 0,
    slippageImpact: 0,
  };
}

// ---------------------------------------------------------------------------
// Handler: takeProfit
// ---------------------------------------------------------------------------

/**
 * Take 50% profit on a specific token by swapping half its balance to USDC.
 *
 * Matching is case-insensitive on symbol. If the token is not found in the
 * wallet, is a stablecoin, or has usdValue <= MIN_USD_VALUE, the plan returns
 * zero steps so callers can surface a meaningful no-op message.
 */
async function takeProfit(
  snapshot: PortfolioSnapshot,
  jupiter: JupiterService,
  tokenSymbol: string,
): Promise<ExecutionPlan> {
  const symbolUpper = tokenSymbol.toUpperCase();

  const token = snapshot.wallet.tokens.find(
    (t) => t.symbol.toUpperCase() === symbolUpper,
  );

  // Token not found, is a stablecoin, or is dust — return empty plan
  if (!token || STABLECOIN_MINTS.has(token.mint) || token.usdValue <= MIN_USD_VALUE) {
    return { steps: [], estimatedCost: 0, slippageImpact: 0 };
  }

  // Sell 50% of the position
  const halfAmount = token.amount / 2;
  const rawAmount = toRawAmount({ ...token, amount: halfAmount });

  let stepParams: Record<string, unknown>;
  let priceImpact = 0;

  try {
    const quote = await jupiter.getQuote(token.mint, USDC_MINT, rawAmount, SWAP_SLIPPAGE_BPS);
    priceImpact = quote.priceImpact;
    stepParams = {
      inputMint: token.mint,
      outputMint: USDC_MINT,
      amount: rawAmount,
      route: quote.route,
      expectedOutputAmount: quote.outputAmount,
    };
  } catch {
    stepParams = {
      inputMint: token.mint,
      outputMint: USDC_MINT,
      amount: rawAmount,
      note: 'quote failed — retry at execution',
    };
  }

  const step: ExecutionStep = {
    action: 'swap',
    description: `Take profit: swap ${halfAmount} ${token.symbol} (50%) to USDC`,
    params: stepParams,
  };

  return {
    steps: [step],
    estimatedCost: COST_PER_STEP_SOL,
    slippageImpact: priceImpact,
  };
}

// ---------------------------------------------------------------------------
// Handler: rebalance
// ---------------------------------------------------------------------------

/**
 * Phase 1: identify overweight tokens relative to an equal-weight allocation
 * across all non-stablecoin wallet tokens and suggest reducing them.
 *
 * Equal-weight target = 1 / N where N = number of non-stable tokens.
 * A token is considered overweight if its allocation exceeds the target by
 * more than 5 percentage points.
 *
 * Steps are informational (action: 'suggest') — no swaps are executed in
 * Phase 1. Sorted descending by excess allocation (most overweight first).
 */
async function rebalance(snapshot: PortfolioSnapshot): Promise<ExecutionPlan> {
  const nonStableTokens = snapshot.wallet.tokens.filter(
    (t) => !STABLECOIN_MINTS.has(t.mint) && t.usdValue > MIN_USD_VALUE,
  );

  if (nonStableTokens.length === 0) {
    return { steps: [], estimatedCost: 0, slippageImpact: 0 };
  }

  const totalValue = nonStableTokens.reduce((sum, t) => sum + t.usdValue, 0);
  const equalWeightTarget = 1 / nonStableTokens.length;

  // Identify overweight tokens (more than 5pp above equal-weight target)
  const overweight = nonStableTokens
    .map((token) => ({
      token,
      allocation: token.usdValue / totalValue,
      excess: token.usdValue / totalValue - equalWeightTarget,
    }))
    .filter((entry) => entry.excess > 0.05)
    .sort((a, b) => b.excess - a.excess);

  const steps: ExecutionStep[] = overweight.map(({ token, allocation, excess }) => ({
    action: 'suggest',
    description:
      `Reduce ${token.symbol}: currently ${(allocation * 100).toFixed(1)}% of portfolio, ` +
      `target ${(equalWeightTarget * 100).toFixed(1)}% — overweight by ${(excess * 100).toFixed(1)}pp`,
    params: {
      mint: token.mint,
      symbol: token.symbol,
      currentAllocation: allocation,
      targetAllocation: equalWeightTarget,
      excessAllocation: excess,
    },
  }));

  return {
    steps,
    estimatedCost: 0,
    slippageImpact: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a token's human-readable amount to raw integer units.
 * SOL uses 9 decimals; all other SPL tokens default to 6.
 */
function toRawAmount(token: TokenBalance): number {
  const decimals = token.mint === SOL_MINT ? 9 : 6;
  return Math.round(token.amount * Math.pow(10, decimals));
}
