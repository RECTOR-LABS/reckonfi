import type {
  TokenBalance,
  Position,
  PriceData,
  PortfolioSnapshot,
  RiskProfile,
  Decision,
  Volatility,
  Trend,
} from '../types/index';

const DEFAULT_RISK_PROFILE: RiskProfile = {
  tolerance: 'moderate',
  avgLeverage: 0,
  historicalActions: [],
};

/**
 * Classify SOL's 24h absolute price change into a volatility tier.
 *
 * Thresholds (absolute value):
 *   > 10% → extreme
 *   > 5%  → high
 *   > 2%  → moderate
 *   else  → low
 */
function classifyVolatility(change24h: number): Volatility {
  const abs = Math.abs(change24h);
  if (abs > 10) return 'extreme';
  if (abs > 5) return 'high';
  if (abs > 2) return 'moderate';
  return 'low';
}

/**
 * Classify SOL's 24h price change into a market trend.
 *
 * > 2%  → bullish
 * < -2% → bearish
 * else  → neutral
 */
function classifyTrend(change24h: number): Trend {
  if (change24h > 2) return 'bullish';
  if (change24h < -2) return 'bearish';
  return 'neutral';
}

/**
 * Build a comprehensive PortfolioSnapshot from raw data sources.
 *
 * @param tokens         - Token balances held in the wallet
 * @param positions      - Open DeFi positions across protocols
 * @param prices         - Current price data for tokens
 * @param riskProfile    - Optional user risk profile (defaults to moderate)
 * @param recentDecisions - Optional recent agent decisions
 */
export function buildPortfolioSnapshot(
  tokens: TokenBalance[],
  positions: Position[],
  prices: PriceData[],
  riskProfile?: RiskProfile,
  recentDecisions?: Decision[],
): PortfolioSnapshot {
  // --- wallet ---
  const totalUSD = tokens.reduce((sum, t) => sum + t.usdValue, 0);

  // --- exposure: byToken ---
  const byToken = new Map<string, number>();
  if (totalUSD > 0) {
    for (const token of tokens) {
      const prev = byToken.get(token.symbol) ?? 0;
      byToken.set(token.symbol, prev + token.usdValue / totalUSD);
    }
  }

  // --- exposure: byProtocol ---
  const byProtocol = new Map<string, number>();
  const totalPositionValue = positions.reduce((sum, p) => sum + p.value, 0);
  if (totalPositionValue > 0) {
    for (const position of positions) {
      const prev = byProtocol.get(position.protocol) ?? 0;
      byProtocol.set(position.protocol, prev + position.value / totalPositionValue);
    }
  }

  // --- exposure: leverageRatio ---
  let totalBorrowing = 0;
  let totalDeposits = 0;
  for (const position of positions) {
    if (position.type === 'borrowing') {
      totalBorrowing += position.value;
    } else if (position.type === 'lending' || position.type === 'lp') {
      totalDeposits += position.value;
    }
  }
  const leverageRatio = totalDeposits > 0 ? totalBorrowing / totalDeposits : 0;

  // --- market ---
  const pricesMap = new Map<string, PriceData>();
  for (const price of prices) {
    pricesMap.set(price.mint, price);
  }

  const solPrice = Array.from(pricesMap.values()).find((p) => p.symbol === 'SOL');
  const solChange24h = solPrice?.change24h ?? 0;

  const volatility = classifyVolatility(solChange24h);
  const trend = classifyTrend(solChange24h);

  return {
    wallet: {
      sol: 0,
      tokens,
      totalUSD,
    },
    positions,
    exposure: {
      byToken,
      byProtocol,
      leverageRatio,
    },
    market: {
      prices: pricesMap,
      volatility,
      trend,
    },
    riskProfile: riskProfile ?? { ...DEFAULT_RISK_PROFILE },
    recentDecisions: recentDecisions ?? [],
  };
}
