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
    const result = await resolveIntent('what is the weather today', makeSnapshot());
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

// ---------------------------------------------------------------------------
// resolveIntent — "take profit on {TOKEN}" intent
// ---------------------------------------------------------------------------

describe('resolveIntent — take profit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a swap step for 50% of the named token', async () => {
    mockGetQuote.mockResolvedValue(makeQuote(0.002));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 4, usdValue: 600 })],
        totalUSD: 600,
      },
    });

    const plan = await resolveIntent('take profit on SOL', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
    expect(plan!.steps[0]!.action).toBe('swap');
    expect(plan!.steps[0]!.description).toMatch(/take profit/i);
    expect(plan!.steps[0]!.description).toMatch(/SOL/);
    expect(plan!.steps[0]!.description).toMatch(/50%/);
    expect(plan!.steps[0]!.params.outputMint).toBe(USDC_MINT);
  });

  it('passes half the raw token amount to Jupiter quote', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 4, usdValue: 600 })],
        totalUSD: 600,
      },
    });

    await resolveIntent('take profit on SOL', snapshot);

    // SOL: 4 / 2 = 2, raw = 2 * 10^9 = 2_000_000_000
    expect(mockGetQuote).toHaveBeenCalledWith(SOL_MINT, USDC_MINT, 2_000_000_000, 50);
  });

  it('is case-insensitive for the token symbol', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 100, usdValue: 200 })],
        totalUSD: 200,
      },
    });

    const plan = await resolveIntent('take profit on ray', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
  });

  it('works with the variant "take profit RAY" (no "on")', async () => {
    mockGetQuote.mockResolvedValue(makeQuote());

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 20, usdValue: 100 })],
        totalUSD: 100,
      },
    });

    const plan = await resolveIntent('take profit RAY', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
    expect(plan!.steps[0]!.params.inputMint).toBe(RAY_MINT);
  });

  it('returns empty steps when token is not in wallet', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 1, usdValue: 150 })],
        totalUSD: 150,
      },
    });

    const plan = await resolveIntent('take profit on JTO', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  it('returns empty steps when token is a stablecoin', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: USDC_MINT, symbol: 'USDC', amount: 500, usdValue: 500 })],
        totalUSD: 500,
      },
    });

    const plan = await resolveIntent('take profit on USDC', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  it('returns empty steps when token usdValue <= 1 (dust)', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 0.001, usdValue: 0.5 })],
        totalUSD: 0.5,
      },
    });

    const plan = await resolveIntent('take profit on RAY', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  it('adds a retry note in step params when quote fails', async () => {
    mockGetQuote.mockRejectedValue(new Error('Jupiter timeout'));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 2, usdValue: 300 })],
        totalUSD: 300,
      },
    });

    const plan = await resolveIntent('take profit on SOL', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(1);
    expect(plan!.steps[0]!.params.note).toMatch(/quote failed/i);
  });

  it('sets estimatedCost to 0.005 (one swap step)', async () => {
    mockGetQuote.mockResolvedValue(makeQuote(0.001));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 2, usdValue: 300 })],
        totalUSD: 300,
      },
    });

    const plan = await resolveIntent('take profit on SOL', snapshot);

    expect(plan!.estimatedCost).toBeCloseTo(0.005, 6);
  });

  it('sets slippageImpact from quote priceImpact', async () => {
    mockGetQuote.mockResolvedValue(makeQuote(0.004));

    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 2, usdValue: 300 })],
        totalUSD: 300,
      },
    });

    const plan = await resolveIntent('take profit on SOL', snapshot);

    expect(plan!.slippageImpact).toBeCloseTo(0.004, 6);
  });
});

// ---------------------------------------------------------------------------
// resolveIntent — "rebalance" intent
// ---------------------------------------------------------------------------

describe('resolveIntent — rebalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns suggest steps for overweight tokens', async () => {
    // SOL = 80%, RAY = 20% — equal weight would be 50/50
    // SOL is overweight by 30pp (> 5pp threshold) → flagged
    // RAY is underweight → not flagged
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 8, usdValue: 800 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 100, usdValue: 200 }),
        ],
        totalUSD: 1000,
      },
    });

    const plan = await resolveIntent('rebalance', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps.length).toBeGreaterThan(0);
    const solStep = plan!.steps.find((s) => (s.params.symbol as string) === 'SOL');
    expect(solStep).toBeDefined();
    expect(solStep!.action).toBe('suggest');
  });

  it('description includes current allocation, target, and overweight amount', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 8, usdValue: 800 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 100, usdValue: 200 }),
        ],
        totalUSD: 1000,
      },
    });

    const plan = await resolveIntent('rebalance', snapshot);
    const solStep = plan!.steps[0]!;

    expect(solStep.description).toMatch(/SOL/);
    expect(solStep.description).toMatch(/80\.0%/);   // current
    expect(solStep.description).toMatch(/50\.0%/);   // target
    expect(solStep.description).toMatch(/30\.0pp/);  // excess
  });

  it('sorts steps descending by excess allocation (most overweight first)', async () => {
    // 4 tokens: SOL=40%, RAY=30%, JTO=20%, ORCA=10% → equal weight 25%
    // SOL excess = +15pp (overweight), RAY excess = +5pp (borderline, exactly 5pp → NOT included, must be > 5pp)
    // JTO underweight, ORCA underweight
    // Use SOL=45%, RAY=35%, JTO=12%, ORCA=8% to guarantee 2 overweight entries
    const ORCA_MINT = 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE';
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 45, usdValue: 450 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 35, usdValue: 350 }),
          makeToken({ mint: JTO_MINT, symbol: 'JTO', amount: 12, usdValue: 120 }),
          makeToken({ mint: ORCA_MINT, symbol: 'ORCA', amount: 8, usdValue: 80 }),
        ],
        totalUSD: 1000,
      },
    });

    // Equal weight = 25%. SOL=45% (+20pp), RAY=35% (+10pp) — both > 5pp threshold
    const plan = await resolveIntent('rebalance', snapshot);

    expect(plan!.steps.length).toBeGreaterThanOrEqual(2);
    // Most overweight (SOL +20pp) comes before RAY (+10pp)
    expect(plan!.steps[0]!.params.symbol).toBe('SOL');
    expect(plan!.steps[1]!.params.symbol).toBe('RAY');
  });

  it('excludes tokens within 5pp of equal weight (not overweight enough)', async () => {
    // Equal portfolio — no token is overweight
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 5, usdValue: 500 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 100, usdValue: 500 }),
        ],
        totalUSD: 1000,
      },
    });

    const plan = await resolveIntent('rebalance', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
  });

  it('excludes stablecoin tokens from rebalance calculation', async () => {
    // USDC should not be counted as a token to rebalance
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 8, usdValue: 800 }),
          makeToken({ mint: USDC_MINT, symbol: 'USDC', amount: 1000, usdValue: 1000 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 100, usdValue: 200 }),
        ],
        totalUSD: 2000,
      },
    });

    const plan = await resolveIntent('rebalance', snapshot);

    // USDC should not appear in suggestions
    const usdcStep = plan!.steps.find((s) => (s.params.symbol as string) === 'USDC');
    expect(usdcStep).toBeUndefined();
  });

  it('returns empty steps when wallet has no non-stable tokens', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: USDC_MINT, symbol: 'USDC', amount: 1000, usdValue: 1000 }),
        ],
        totalUSD: 1000,
      },
    });

    const plan = await resolveIntent('rebalance', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
  });

  it('returns empty steps when wallet tokens list is empty', async () => {
    const snapshot = makeSnapshot({
      wallet: { sol: 0, tokens: [], totalUSD: 0 },
    });

    const plan = await resolveIntent('rebalance', snapshot);

    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
  });

  it('does not call JupiterService (Phase 1 is suggest-only)', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 9, usdValue: 900 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 50, usdValue: 100 }),
        ],
        totalUSD: 1000,
      },
    });

    await resolveIntent('rebalance', snapshot);

    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  it('returns estimatedCost=0 and slippageImpact=0', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 9, usdValue: 900 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 50, usdValue: 100 }),
        ],
        totalUSD: 1000,
      },
    });

    const plan = await resolveIntent('rebalance', snapshot);

    expect(plan!.estimatedCost).toBe(0);
    expect(plan!.slippageImpact).toBe(0);
  });

  it('is case-insensitive — "REBALANCE" also triggers the handler', async () => {
    const snapshot = makeSnapshot({
      wallet: {
        sol: 0,
        tokens: [
          makeToken({ mint: SOL_MINT, symbol: 'SOL', amount: 9, usdValue: 900 }),
          makeToken({ mint: RAY_MINT, symbol: 'RAY', amount: 50, usdValue: 100 }),
        ],
        totalUSD: 1000,
      },
    });

    const plan = await resolveIntent('REBALANCE my portfolio', snapshot);

    expect(plan).not.toBeNull();
  });
});
