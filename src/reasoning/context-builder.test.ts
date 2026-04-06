import { describe, it, expect } from 'vitest';
import type { TokenBalance, Position, PriceData, RiskProfile, Decision } from '../types/index';
import { buildPortfolioSnapshot } from './context-builder';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeToken(
  symbol: string,
  usdValue: number,
  mint = `mint_${symbol}`,
): TokenBalance {
  return { mint, symbol, amount: usdValue, usdValue };
}

function makePosition(
  protocol: Position['protocol'],
  type: Position['type'],
  value: number,
  healthFactor: number | null = null,
): Position {
  return {
    protocol,
    type,
    tokens: [],
    value,
    healthFactor,
    liquidationPrice: null,
    pnl: 0,
    apy: 0,
    metadata: {},
  };
}

function makePrice(
  mint: string,
  symbol: string,
  price: number,
  change24h: number,
): PriceData {
  return { mint, symbol, price, change24h };
}

// ---------------------------------------------------------------------------
// buildPortfolioSnapshot
// ---------------------------------------------------------------------------

describe('buildPortfolioSnapshot', () => {
  it('assembles totalUSD as sum of token usdValues', () => {
    const tokens = [makeToken('SOL', 500), makeToken('USDC', 300), makeToken('ETH', 200)];
    const snapshot = buildPortfolioSnapshot(tokens, [], []);
    expect(snapshot.wallet.totalUSD).toBe(1000);
    expect(snapshot.wallet.tokens).toEqual(tokens);
  });

  it('computes byToken exposure as share of totalUSD', () => {
    const tokens = [makeToken('SOL', 700, 'sol_mint'), makeToken('USDC', 300, 'usdc_mint')];
    const snapshot = buildPortfolioSnapshot(tokens, [], []);
    expect(snapshot.exposure.byToken.get('SOL')).toBeCloseTo(0.7, 10);
    expect(snapshot.exposure.byToken.get('USDC')).toBeCloseTo(0.3, 10);
  });

  it('computes byProtocol exposure as share of total position value', () => {
    const positions = [
      makePosition('kamino', 'lending', 600),
      makePosition('drift', 'perp-long', 400),
    ];
    const snapshot = buildPortfolioSnapshot([], positions, []);
    expect(snapshot.exposure.byProtocol.get('kamino')).toBeCloseTo(0.6, 10);
    expect(snapshot.exposure.byProtocol.get('drift')).toBeCloseTo(0.4, 10);
  });

  it('aggregates multiple positions from the same protocol', () => {
    const positions = [
      makePosition('kamino', 'lending', 400),
      makePosition('kamino', 'borrowing', 600),
    ];
    const snapshot = buildPortfolioSnapshot([], positions, []);
    // total = 1000, kamino = 1000 → 100%
    expect(snapshot.exposure.byProtocol.get('kamino')).toBeCloseTo(1.0, 10);
    expect(snapshot.exposure.byProtocol.size).toBe(1);
  });

  it('computes leverageRatio as borrowing / (lending + lp)', () => {
    const positions = [
      makePosition('kamino', 'lending', 2000),
      makePosition('kamino', 'borrowing', 1000),
      makePosition('orca' as Position['protocol'], 'lp', 500),
    ];
    // borrowing = 1000, deposits = lending(2000) + lp(500) = 2500
    // ratio = 1000 / 2500 = 0.4
    const snapshot = buildPortfolioSnapshot([], positions, []);
    expect(snapshot.exposure.leverageRatio).toBeCloseTo(0.4, 10);
  });

  it('returns leverageRatio 0 when there are no deposit positions', () => {
    const positions = [makePosition('drift', 'perp-long', 1000)];
    const snapshot = buildPortfolioSnapshot([], positions, []);
    expect(snapshot.exposure.leverageRatio).toBe(0);
  });

  it('returns leverageRatio 0 when there are no positions at all', () => {
    const snapshot = buildPortfolioSnapshot([], [], []);
    expect(snapshot.exposure.leverageRatio).toBe(0);
  });

  it('builds market.prices as Map of mint → PriceData', () => {
    const prices = [
      makePrice('sol_mint', 'SOL', 150, 3),
      makePrice('usdc_mint', 'USDC', 1, 0),
    ];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.prices.get('sol_mint')).toEqual(prices[0]);
    expect(snapshot.market.prices.get('usdc_mint')).toEqual(prices[1]);
  });

  // --- volatility ---
  it('sets volatility to extreme when SOL 24h change > 10%', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, 11)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.volatility).toBe('extreme');
  });

  it('sets volatility to high when SOL 24h change is between 5% and 10%', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, 7)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.volatility).toBe('high');
  });

  it('sets volatility to moderate when SOL 24h change is between 2% and 5%', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, 3)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.volatility).toBe('moderate');
  });

  it('sets volatility to low when SOL 24h change <= 2%', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, 1)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.volatility).toBe('low');
  });

  it('uses absolute value for negative 24h change in volatility', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, -8)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.volatility).toBe('high');
  });

  it('defaults volatility to low when no SOL price available', () => {
    const prices = [makePrice('usdc_mint', 'USDC', 1, 0)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.volatility).toBe('low');
  });

  // --- trend ---
  it('sets trend to bullish when SOL 24h change > 2%', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, 5)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.trend).toBe('bullish');
  });

  it('sets trend to bearish when SOL 24h change < -2%', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, -5)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.trend).toBe('bearish');
  });

  it('sets trend to neutral when SOL 24h change is between -2% and 2%', () => {
    const prices = [makePrice('sol_mint', 'SOL', 150, 1)];
    const snapshot = buildPortfolioSnapshot([], [], prices);
    expect(snapshot.market.trend).toBe('neutral');
  });

  it('defaults trend to neutral when no SOL price available', () => {
    const snapshot = buildPortfolioSnapshot([], [], []);
    expect(snapshot.market.trend).toBe('neutral');
  });

  // --- riskProfile ---
  it('uses provided riskProfile', () => {
    const riskProfile: RiskProfile = { tolerance: 'aggressive', avgLeverage: 2.5, historicalActions: ['buy'] };
    const snapshot = buildPortfolioSnapshot([], [], [], riskProfile);
    expect(snapshot.riskProfile).toEqual(riskProfile);
  });

  it('defaults to moderate riskProfile when not provided', () => {
    const snapshot = buildPortfolioSnapshot([], [], []);
    expect(snapshot.riskProfile.tolerance).toBe('moderate');
    expect(snapshot.riskProfile.avgLeverage).toBe(0);
    expect(snapshot.riskProfile.historicalActions).toEqual([]);
  });

  // --- recentDecisions ---
  it('uses provided recentDecisions', () => {
    const decision: Decision = {
      timestamp: 1000,
      recommendation: 'hold',
      userAction: 'hold',
      outcome: null,
    };
    const snapshot = buildPortfolioSnapshot([], [], [], undefined, [decision]);
    expect(snapshot.recentDecisions).toEqual([decision]);
  });

  it('defaults recentDecisions to empty array when not provided', () => {
    const snapshot = buildPortfolioSnapshot([], [], []);
    expect(snapshot.recentDecisions).toEqual([]);
  });

  // --- empty inputs ---
  it('handles all-empty inputs gracefully', () => {
    const snapshot = buildPortfolioSnapshot([], [], []);
    expect(snapshot.wallet.totalUSD).toBe(0);
    expect(snapshot.exposure.byToken.size).toBe(0);
    expect(snapshot.exposure.byProtocol.size).toBe(0);
    expect(snapshot.exposure.leverageRatio).toBe(0);
    expect(snapshot.market.prices.size).toBe(0);
  });

  it('handles zero totalUSD (all tokens with 0 usdValue) without NaN shares', () => {
    const tokens = [makeToken('SOL', 0), makeToken('USDC', 0)];
    const snapshot = buildPortfolioSnapshot(tokens, [], []);
    expect(snapshot.wallet.totalUSD).toBe(0);
    for (const [, share] of snapshot.exposure.byToken) {
      expect(Number.isNaN(share)).toBe(false);
    }
  });

  it('handles zero total position value without NaN protocol shares', () => {
    const positions = [makePosition('kamino', 'lending', 0)];
    const snapshot = buildPortfolioSnapshot([], positions, []);
    for (const [, share] of snapshot.exposure.byProtocol) {
      expect(Number.isNaN(share)).toBe(false);
    }
  });
});
