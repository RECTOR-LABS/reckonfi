import { describe, it, expect } from 'vitest';
import type { TokenBalance, Position, PriceData, PortfolioSnapshot, RiskProfile } from '../types/index';
import { analyzePortfolio } from './engine';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeToken(symbol: string, usdValue: number, mint = `mint_${symbol}`): TokenBalance {
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

function makeSnapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  const defaultRiskProfile: RiskProfile = {
    tolerance: 'moderate',
    avgLeverage: 0,
    historicalActions: [],
  };
  return {
    wallet: { sol: 10, tokens: [], totalUSD: 10000 },
    positions: [],
    exposure: {
      byToken: new Map(),
      byProtocol: new Map(),
      leverageRatio: 0,
    },
    market: {
      prices: new Map(),
      volatility: 'low',
      trend: 'neutral',
    },
    riskProfile: defaultRiskProfile,
    recentDecisions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// analyzePortfolio
// ---------------------------------------------------------------------------

describe('analyzePortfolio', () => {
  it('returns a result with analysis string, risks array, and recommendation', () => {
    const snapshot = makeSnapshot();
    const result = analyzePortfolio(snapshot);
    expect(typeof result.analysis).toBe('string');
    expect(result.analysis.length).toBeGreaterThan(0);
    expect(Array.isArray(result.risks)).toBe(true);
    expect(typeof result.recommendation).toBe('object');
    expect(typeof result.recommendation.action).toBe('string');
    expect(typeof result.recommendation.reasoning).toBe('string');
    expect(['low', 'medium', 'high']).toContain(result.recommendation.confidence);
  });

  it('analysis includes portfolio value and market info', () => {
    const snapshot = makeSnapshot({
      wallet: { sol: 10, tokens: [], totalUSD: 25000 },
      market: {
        prices: new Map(),
        volatility: 'high',
        trend: 'bullish',
      },
    });
    const result = analyzePortfolio(snapshot);
    expect(result.analysis).toMatch(/25000|25,000/);
    expect(result.analysis.toLowerCase()).toMatch(/high|bullish/);
  });

  // --- concentration risk ---
  it('flags concentration risk when one token dominates (> 50%)', () => {
    const byToken = new Map([['SOL', 0.9], ['USDC', 0.1]]);
    const snapshot = makeSnapshot({ exposure: { byToken, byProtocol: new Map(), leverageRatio: 0 } });
    const result = analyzePortfolio(snapshot);
    const hasConcentrationRisk = result.risks.some(
      (r) => r.description.toLowerCase().includes('concentrat'),
    );
    expect(hasConcentrationRisk).toBe(true);
  });

  it('does not flag concentration risk for a well-diversified portfolio', () => {
    const byToken = new Map([
      ['SOL', 0.25],
      ['ETH', 0.25],
      ['BTC', 0.25],
      ['USDC', 0.25],
    ]);
    const snapshot = makeSnapshot({ exposure: { byToken, byProtocol: new Map(), leverageRatio: 0 } });
    const result = analyzePortfolio(snapshot);
    const hasConcentrationRisk = result.risks.some(
      (r) => r.description.toLowerCase().includes('concentrat'),
    );
    expect(hasConcentrationRisk).toBe(false);
  });

  // --- liquidation risk ---
  it('flags positions near liquidation when healthFactor < 1.25', () => {
    const position = makePosition('kamino', 'lending', 5000, 1.1);
    const snapshot = makeSnapshot({ positions: [position] });
    const result = analyzePortfolio(snapshot);
    const hasLiqRisk = result.risks.some((r) =>
      r.description.toLowerCase().includes('liquidat'),
    );
    expect(hasLiqRisk).toBe(true);
  });

  it('does not flag liquidation risk for healthy positions (hf >= 1.25)', () => {
    const position = makePosition('kamino', 'lending', 5000, 2.0);
    const snapshot = makeSnapshot({ positions: [position] });
    const result = analyzePortfolio(snapshot);
    const hasLiqRisk = result.risks.some(
      (r) => r.description.toLowerCase().includes('liquidat'),
    );
    expect(hasLiqRisk).toBe(false);
  });

  it('assigns critical severity when healthFactor is extremely low (hf < 1.05)', () => {
    const position = makePosition('kamino', 'lending', 5000, 1.02);
    const snapshot = makeSnapshot({ positions: [position] });
    const result = analyzePortfolio(snapshot);
    const critLiqRisk = result.risks.find(
      (r) => r.description.toLowerCase().includes('liquidat') && r.severity === 'critical',
    );
    expect(critLiqRisk).toBeDefined();
  });

  // --- leverage risk ---
  it('flags high leverage risk when leverageRatio > 0.7', () => {
    const snapshot = makeSnapshot({
      exposure: { byToken: new Map(), byProtocol: new Map(), leverageRatio: 0.8 },
    });
    const result = analyzePortfolio(snapshot);
    const hasLeverageRisk = result.risks.some((r) =>
      r.description.toLowerCase().includes('leverage'),
    );
    expect(hasLeverageRisk).toBe(true);
  });

  it('does not flag leverage risk when leverageRatio <= 0.7', () => {
    const snapshot = makeSnapshot({
      exposure: { byToken: new Map(), byProtocol: new Map(), leverageRatio: 0.5 },
    });
    const result = analyzePortfolio(snapshot);
    const hasLeverageRisk = result.risks.some((r) =>
      r.description.toLowerCase().includes('leverage'),
    );
    expect(hasLeverageRisk).toBe(false);
  });

  // --- market volatility + leveraged positions ---
  it('flags volatile market risk when high volatility with leveraged positions', () => {
    const position = makePosition('kamino', 'borrowing', 3000, null);
    const snapshot = makeSnapshot({
      positions: [position],
      exposure: { byToken: new Map(), byProtocol: new Map(), leverageRatio: 0.5 },
      market: { prices: new Map(), volatility: 'extreme', trend: 'bearish' },
    });
    const result = analyzePortfolio(snapshot);
    const hasVolatilityRisk = result.risks.some((r) =>
      r.description.toLowerCase().includes('volatilit') ||
      r.description.toLowerCase().includes('market'),
    );
    expect(hasVolatilityRisk).toBe(true);
  });

  // --- recommendation ---
  it('gives "hold steady" recommendation for a healthy portfolio', () => {
    const byToken = new Map([
      ['SOL', 0.25],
      ['ETH', 0.25],
      ['BTC', 0.25],
      ['USDC', 0.25],
    ]);
    const snapshot = makeSnapshot({
      exposure: { byToken, byProtocol: new Map(), leverageRatio: 0 },
      market: { prices: new Map(), volatility: 'low', trend: 'neutral' },
    });
    const result = analyzePortfolio(snapshot);
    expect(result.recommendation.action.toLowerCase()).toMatch(/hold/);
  });

  it('gives an urgent/reduce recommendation when there is a critical risk', () => {
    const position = makePosition('kamino', 'lending', 5000, 1.01);
    const snapshot = makeSnapshot({ positions: [position] });
    const result = analyzePortfolio(snapshot);
    const action = result.recommendation.action.toLowerCase();
    expect(action).not.toMatch(/^hold steady$/);
  });

  // --- risks sorting ---
  it('sorts risks by severity (critical first)', () => {
    const positions = [
      makePosition('kamino', 'lending', 5000, 1.01),  // critical
      makePosition('drift', 'lending', 1000, 1.15),   // medium
    ];
    const byToken = new Map([['SOL', 0.95], ['USDC', 0.05]]); // also concentration
    const snapshot = makeSnapshot({
      positions,
      exposure: { byToken, byProtocol: new Map(), leverageRatio: 0 },
    });
    const result = analyzePortfolio(snapshot);
    const severityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
    for (let i = 0; i < result.risks.length - 1; i++) {
      expect(severityOrder[result.risks[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[result.risks[i + 1].severity],
      );
    }
  });

  it('analysis mentions the number of risks when risks exist', () => {
    const position = makePosition('kamino', 'lending', 5000, 1.1);
    const snapshot = makeSnapshot({ positions: [position] });
    const result = analyzePortfolio(snapshot);
    // Should mention risk count in analysis
    expect(result.analysis).toMatch(/\d+\s*risk/i);
  });

  it('includes health score in analysis', () => {
    const position = makePosition('kamino', 'lending', 5000, 2.0);
    const snapshot = makeSnapshot({ positions: [position] });
    const result = analyzePortfolio(snapshot);
    expect(result.analysis.toLowerCase()).toMatch(/health/);
  });
});
