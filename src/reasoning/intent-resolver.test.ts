import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PortfolioSnapshot, TokenBalance, Position } from '../types/index';

// ---------------------------------------------------------------------------
// Mock JupiterService before importing the module under test
// ---------------------------------------------------------------------------

const mockGetQuote = vi.fn();

vi.mock('../services/jupiter.service', () => {
  const JupiterService = vi.fn(function (this: { getQuote: typeof mockGetQuote }) {
    this.getQuote = mockGetQuote;
  });
  return { JupiterService };
});

// Import after mock is registered
const { resolveIntent } = await import('./intent-resolver');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const RAY_MINT = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
const JTO_MINT = 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL';

function makeToken(overrides: Partial<TokenBalance>): TokenBalance {
  return {
    mint: SOL_MINT,
    symbol: 'SOL',
    amount: 1,
    usdValue: 150,
    ...overrides,
  };
}

function makePosition(overrides: Partial<Position>): Position {
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

function makeSnapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    wallet: {
      sol: 2,
      tokens: [],
      totalUSD: 500,
    },
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
    riskProfile: {
      tolerance: 'moderate',
      avgLeverage: 1,
      historicalActions: [],
    },
    recentDecisions: [],
    ...overrides,
  };
}

function makeQuote(priceImpact = 0.002) {
  return {
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    inputAmount: 1_000_000_000,
    outputAmount: 149_000_000,
    slippage: 0.005,
    route: 'Orca',
    priceImpact,
  };
}

// ---------------------------------------------------------------------------
// resolveIntent — unrecognized intent
// ---------------------------------------------------------------------------

describe('resolveIntent — unrecognized intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for an empty string', async () => {
    const result = await resolveIntent('', makeSnapshot());
    expect(result).toBeNull();
  });

  it('returns null for a completely unrelated string', async () => {
    const result = await resolveIntent('rebalance portfolio', makeSnapshot());
    expect(result).toBeNull();
  });

  it('returns null for a partial match that is not a recognized pattern', async () => {
    const result = await resolveIntent('stables are great', makeSnapshot());
    expect(result).toBeNull();
  });

  it('does not call JupiterService for unrecognized intents', async () => {
    await resolveIntent('do something random', makeSnapshot());
    expect(mockGetQuote).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// resolveIntent — "move to stables" intent
// ---------------------------------------------------------------------------

describe('resolveIntent — move to stables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an ExecutionPlan with swap steps for non-stable tokens', async () => {
    mockGetQuote.mockResolvedValue(makeQuote(0.003));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 2,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 2, usdValue: 300 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 50, usdValue: 75 }),
        ],
        totalUSD: 375,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(2);

    for (const step of plan!.steps) {
      expect(step.action).toBe('swap');
      expect(step.description).toMatch(/Swap .+ to USDC/);
      expect(step.params).toHaveProperty('inputMint');
      expect(step.params).toHaveProperty('outputMint', USDC_MINT);
      expect(step.params).toHaveProperty('amount');
    }
  });

  it('handles plural variant "move to stable"', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 1,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 })],
        totalUSD: 150,
      },
    });

    const plan = await resolveIntent('move to stable', snapshot);
    expect(plan).not.toBeNull();
  });

  it('is case-insensitive', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 1,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 })],
        totalUSD: 150,
      },
    });

    const plan = await resolveIntent('MOVE TO STABLES', snapshot);
    expect(plan).not.toBeNull();
  });

  it('filters out USDC tokens (skips stables)', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: USDC_MINT, symbol: 'USDC', amount: 500, usdValue: 500 }),
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 }),
        ],
        totalUSD: 650,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
    expect(plan!.steps[0]!.params.inputMint).toBe(SOL_MINT);
  });

  it('filters out USDT tokens (skips stables)', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: USDT_MINT, symbol: 'USDT', amount: 200, usdValue: 200 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 100, usdValue: 80 }),
        ],
        totalUSD: 280,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
    expect(plan!.steps[0]!.params.inputMint).toBe(RAY_MINT);
  });

  it('skips tokens with usdValue <= 1 (dust filter)', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 0.001, usdValue: 0.5 }),
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 }),
        ],
        totalUSD: 150.5,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
    expect(plan!.steps[0]!.params.inputMint).toBe(SOL_MINT);
  });

  it('returns empty steps array when wallet has only stablecoin tokens', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: USDC_MINT, symbol: 'USDC', amount: 1000, usdValue: 1000 }),
        ],
        totalUSD: 1000,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
    expect(plan!.estimatedCost).toBe(0);
    expect(plan!.slippageImpact).toBe(0);
  });

  it('uses SOL decimals=9 for amount calculation', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 2.5, usdValue: 375 })],
        totalUSD: 375,
      },
    });

    await resolveIntent('move to stables', snapshot);

    expect(mockGetQuote).toHaveBeenCalledWith(
      SOL_MINT,
      USDC_MINT,
      2_500_000_000, // 2.5 * 10^9
      50
    );
  });

  it('uses 6 decimals for non-SOL tokens', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 10, usdValue: 50 })],
        totalUSD: 50,
      },
    });

    await resolveIntent('move to stables', snapshot);

    expect(mockGetQuote).toHaveBeenCalledWith(
      RAY_MINT,
      USDC_MINT,
      10_000_000, // 10 * 10^6
      50
    );
  });

  it('computes estimatedCost as 0.005 * steps.length', async () => {
    mockGetQuote.mockResolvedValue(makeQuote(0.001));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 10, usdValue: 30 }),
          makeToken({ mint: JTO_MINT, symbol: 'JTO', amount: 5, usdValue: 25 }),
        ],
        totalUSD: 205,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(3);
    expect(plan!.estimatedCost).toBeCloseTo(0.015, 6); // 0.005 * 3
  });

  it('computes slippageImpact as sum of priceImpacts', async () => {
    mockGetQuote
      .mockResolvedValueOnce(makeQuote(0.003))
      .mockResolvedValueOnce(makeQuote(0.007));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 10, usdValue: 30 }),
        ],
        totalUSD: 180,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.slippageImpact).toBeCloseTo(0.01, 6); // 0.003 + 0.007
  });

  it('adds a step with note when quote fails, without throwing', async () => {
    mockGetQuote.mockRejectedValue(new Error('Jupiter Quote API error: 429'));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 })],
        totalUSD: 150,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
    expect(plan!.steps[0]!.params.note).toMatch(/quote failed/i);
  });

  it('includes route in step params when quote succeeds', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 })],
        totalUSD: 150,
      },
    });

    const plan = await resolveIntent('move to stables', snapshot);

    expect(plan!.steps[0]!.params.route).toBe('Orca');
  });
});

// ---------------------------------------------------------------------------
// resolveIntent — "reduce risk" intent
// ---------------------------------------------------------------------------

describe('resolveIntent — reduce risk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an ExecutionPlan with add_collateral steps for positions with healthFactor < 1.5', async () => {
    const snapshot = makeSnapshot({
      positions: [
        makePosition({ protocol: 'kamino', type: 'lending', healthFactor: 1.3 }),
        makePosition({ protocol: 'marginfi', type: 'borrowing', healthFactor: 1.1 }),
        makePosition({ protocol: 'drift', type: 'perp-long', healthFactor: 2.0 }), // safe — excluded
      ],
    });

    const plan = await resolveIntent('reduce risk', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(2);

    for (const step of plan!.steps) {
      expect(step.action).toBe('add_collateral');
      expect(step.description).toBeTruthy();
    }
  });

  it('sorts risky positions ascending by healthFactor (most critical first)', async () => {
    const snapshot = makeSnapshot({
      positions: [
        makePosition({ protocol: 'kamino', type: 'lending', healthFactor: 1.4 }),
        makePosition({ protocol: 'marginfi', type: 'borrowing', healthFactor: 1.1 }),
        makePosition({ protocol: 'drift', type: 'lending', healthFactor: 1.2 }),
      ],
    });

    const plan = await resolveIntent('reduce risk', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(3);

    // Most critical (hf=1.1) first
    expect(plan!.steps[0]!.description).toMatch(/marginfi/i);
    expect(plan!.steps[1]!.description).toMatch(/drift/i);
    expect(plan!.steps[2]!.description).toMatch(/kamino/i);
  });

  it('includes protocol name and position type in step description', async () => {
    const snapshot = makeSnapshot({
      positions: [
        makePosition({ protocol: 'marginfi', type: 'borrowing', healthFactor: 1.2 }),
      ],
    });

    const plan = await resolveIntent('reduce risk', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps[0]!.description).toMatch(/marginfi/i);
    expect(plan!.steps[0]!.description).toMatch(/borrowing/i);
  });

  it('includes healthFactor value in step description', async () => {
    const snapshot = makeSnapshot({
      positions: [
        makePosition({ protocol: 'kamino', type: 'lending', healthFactor: 1.35 }),
      ],
    });

    const plan = await resolveIntent('reduce risk', snapshot);

    expect(plan!.steps[0]!.description).toMatch(/1\.35/);
  });

  it('returns empty steps when no positions have healthFactor < 1.5', async () => {
    const snapshot = makeSnapshot({
      positions: [
        makePosition({ healthFactor: 1.5 }),  // boundary — not included (must be < 1.5)
        makePosition({ healthFactor: 2.0 }),
        makePosition({ healthFactor: null }),  // no health factor — excluded
      ],
    });

    const plan = await resolveIntent('reduce risk', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
  });

  it('excludes positions with null healthFactor', async () => {
    const snapshot = makeSnapshot({
      positions: [
        makePosition({ healthFactor: null }),
        makePosition({ healthFactor: 1.2 }),
      ],
    });

    const plan = await resolveIntent('reduce risk', snapshot);

    expect(plan!.steps).toHaveLength(1);
  });

  it('does not call JupiterService for reduce risk intent', async () => {
    const snapshot = makeSnapshot({
      positions: [makePosition({ healthFactor: 1.1 })],
    });

    await resolveIntent('reduce risk', snapshot);

    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  it('returns estimatedCost=0 and slippageImpact=0 for reduce risk', async () => {
    const snapshot = makeSnapshot({
      positions: [makePosition({ healthFactor: 1.2 })],
    });

    const plan = await resolveIntent('reduce risk', snapshot);

    expect(plan!.estimatedCost).toBe(0);
    expect(plan!.slippageImpact).toBe(0);
  });
});
