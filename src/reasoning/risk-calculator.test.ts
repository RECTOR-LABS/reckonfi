import { describe, it, expect } from 'vitest';
import type { Position } from '../types/index';
import {
  portfolioHealthScore,
  liquidationDistance,
  concentrationRisk,
} from './risk-calculator';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    protocol: 'kamino',
    type: 'lending',
    tokens: [],
    value: 1000,
    healthFactor: 2.0,
    liquidationPrice: null,
    pnl: 0,
    apy: 0,
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// portfolioHealthScore
// ---------------------------------------------------------------------------

describe('portfolioHealthScore', () => {
  it('returns 100 for empty positions array', () => {
    expect(portfolioHealthScore([])).toBe(100);
  });

  it('returns 100 when all positions have null healthFactor', () => {
    const positions = [
      makePosition({ healthFactor: null, value: 500 }),
      makePosition({ healthFactor: null, value: 1000 }),
    ];
    expect(portfolioHealthScore(positions)).toBe(100);
  });

  it('returns 100 when total value is zero', () => {
    const positions = [makePosition({ value: 0, healthFactor: 1.5 })];
    expect(portfolioHealthScore(positions)).toBe(100);
  });

  it('maps hf=1.0 to score 0', () => {
    const positions = [makePosition({ healthFactor: 1.0, value: 1000 })];
    expect(portfolioHealthScore(positions)).toBe(0);
  });

  it('maps hf=2.0 to score 80', () => {
    const positions = [makePosition({ healthFactor: 2.0, value: 1000 })];
    expect(portfolioHealthScore(positions)).toBe(80);
  });

  it('maps hf=3.0 to score 100', () => {
    const positions = [makePosition({ healthFactor: 3.0, value: 1000 })];
    expect(portfolioHealthScore(positions)).toBe(100);
  });

  it('clamps hf>3.0 to score 100', () => {
    const positions = [makePosition({ healthFactor: 5.0, value: 1000 })];
    expect(portfolioHealthScore(positions)).toBe(100);
  });

  it('returns 100 for a healthy position (hf=2.5, clamped)', () => {
    // ((2.5 - 1.0) / 1.25) * 100 = 120, clamped to 100
    const positions = [makePosition({ healthFactor: 2.5, value: 1000 })];
    const score = portfolioHealthScore(positions);
    expect(score).toBe(100);
  });

  it('returns <30 for a near-liquidation position (hf=1.1)', () => {
    const positions = [makePosition({ healthFactor: 1.1, value: 1000 })];
    const score = portfolioHealthScore(positions);
    expect(score).toBeLessThan(30);
  });

  it('is value-weighted across multiple positions', () => {
    // Large healthy position should pull score up
    const positions = [
      makePosition({ healthFactor: 1.05, value: 100 }),   // nearly liquidated, small
      makePosition({ healthFactor: 3.0, value: 10000 }),  // very healthy, large
    ];
    const score = portfolioHealthScore(positions);
    // Dominant healthy position means score closer to 100 than 0
    expect(score).toBeGreaterThan(90);
  });

  it('correctly weight-averages two equal-value positions', () => {
    // hf=1.0 → score=0, hf=3.0 → score=100 — equal values → weighted avg = 50
    const positions = [
      makePosition({ healthFactor: 1.0, value: 500 }),
      makePosition({ healthFactor: 3.0, value: 500 }),
    ];
    expect(portfolioHealthScore(positions)).toBe(50);
  });

  it('skips null healthFactor positions in weighting', () => {
    // Only the hf=2.0 position contributes — should equal single-position result
    const withNull = [
      makePosition({ healthFactor: null, value: 5000 }),
      makePosition({ healthFactor: 2.0, value: 1000 }),
    ];
    const single = [makePosition({ healthFactor: 2.0, value: 1000 })];
    expect(portfolioHealthScore(withNull)).toBe(portfolioHealthScore(single));
  });
});

// ---------------------------------------------------------------------------
// liquidationDistance
// ---------------------------------------------------------------------------

describe('liquidationDistance', () => {
  it('returns null when healthFactor is null', () => {
    const position = makePosition({ healthFactor: null });
    expect(liquidationDistance(position)).toBeNull();
  });

  it('returns 0 when healthFactor is exactly 1.0', () => {
    const position = makePosition({ healthFactor: 1.0 });
    expect(liquidationDistance(position)).toBe(0);
  });

  it('returns 0 when healthFactor is below 1.0', () => {
    const position = makePosition({ healthFactor: 0.9 });
    expect(liquidationDistance(position)).toBe(0);
  });

  it('returns ~33.33% for hf=1.5', () => {
    const position = makePosition({ healthFactor: 1.5 });
    const result = liquidationDistance(position);
    expect(result).not.toBeNull();
    expect(result as number).toBeCloseTo(33.33, 2);
  });

  it('returns 50% for hf=2.0', () => {
    const position = makePosition({ healthFactor: 2.0 });
    const result = liquidationDistance(position);
    expect(result).not.toBeNull();
    expect(result as number).toBeCloseTo(50, 2);
  });

  it('returns ~66.67% for hf=3.0', () => {
    const position = makePosition({ healthFactor: 3.0 });
    const result = liquidationDistance(position);
    expect(result).not.toBeNull();
    expect(result as number).toBeCloseTo(66.67, 2);
  });
});

// ---------------------------------------------------------------------------
// concentrationRisk (HHI)
// ---------------------------------------------------------------------------

describe('concentrationRisk', () => {
  it('returns 0 for an empty map', () => {
    expect(concentrationRisk(new Map())).toBe(0);
  });

  it('returns 1.0 for a single token at 100%', () => {
    const exposure = new Map([['SOL', 1000]]);
    expect(concentrationRisk(exposure)).toBe(1.0);
  });

  it('returns 0.25 for 4 tokens at equal 25% each', () => {
    const exposure = new Map([
      ['SOL', 250],
      ['ETH', 250],
      ['BTC', 250],
      ['USDC', 250],
    ]);
    expect(concentrationRisk(exposure)).toBeCloseTo(0.25, 10);
  });

  it('returns 0.5 for two tokens at 50% each', () => {
    const exposure = new Map([
      ['SOL', 500],
      ['USDC', 500],
    ]);
    expect(concentrationRisk(exposure)).toBeCloseTo(0.5, 10);
  });

  it('returns value between 0 and 1 for any valid distribution', () => {
    const exposure = new Map([
      ['SOL', 700],
      ['ETH', 200],
      ['USDC', 100],
    ]);
    const hhi = concentrationRisk(exposure);
    expect(hhi).toBeGreaterThan(0);
    expect(hhi).toBeLessThanOrEqual(1);
  });

  it('is higher for concentrated than diversified portfolio', () => {
    const concentrated = new Map([['SOL', 900], ['USDC', 100]]);
    const diversified = new Map([
      ['SOL', 250], ['ETH', 250], ['BTC', 250], ['USDC', 250],
    ]);
    expect(concentrationRisk(concentrated)).toBeGreaterThan(concentrationRisk(diversified));
  });
});
