import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TokenBalance, Position, PriceData } from '../types/index';

// ---------------------------------------------------------------------------
// Mock all services at module level (before SUT import)
// ---------------------------------------------------------------------------

const mockGetAssetsByOwner = vi.fn();
const mockGetPrices = vi.fn();
const mockKaminoGetPositions = vi.fn();
const mockDriftGetPositions = vi.fn();
const mockMarginfiGetPositions = vi.fn();

vi.mock('../services/helius.service', () => {
  const HeliusService = vi.fn(function (
    this: { getAssetsByOwner: typeof mockGetAssetsByOwner }
  ) {
    this.getAssetsByOwner = mockGetAssetsByOwner;
  });
  return { HeliusService };
});

vi.mock('../services/jupiter.service', () => {
  const JupiterService = vi.fn(function (
    this: { getPrices: typeof mockGetPrices }
  ) {
    this.getPrices = mockGetPrices;
  });
  return { JupiterService };
});

vi.mock('../services/kamino.service', () => {
  const KaminoService = vi.fn(function (
    this: { getPositions: typeof mockKaminoGetPositions }
  ) {
    this.getPositions = mockKaminoGetPositions;
  });
  return { KaminoService };
});

vi.mock('../services/drift.service', () => {
  const DriftService = vi.fn(function (
    this: { getPositions: typeof mockDriftGetPositions }
  ) {
    this.getPositions = mockDriftGetPositions;
  });
  return { DriftService };
});

vi.mock('../services/marginfi.service', () => {
  const MarginfiService = vi.fn(function (
    this: { getPositions: typeof mockMarginfiGetPositions }
  ) {
    this.getPositions = mockMarginfiGetPositions;
  });
  return { MarginfiService };
});

// Mock the risk profiler evaluator so we can assert it is called.
// The factory must not reference outer variables (vi.mock is hoisted).
vi.mock('../evaluators/risk-profiler', () => ({
  getRiskProfile: vi.fn().mockReturnValue({
    tolerance: 'moderate',
    avgLeverage: 0,
    historicalActions: [],
  }),
}));

// Import SUT and mock helpers after all mocks are registered
import { analyzePortfolioAction } from './analyze-portfolio';
import { getRiskProfile as mockGetRiskProfile } from '../evaluators/risk-profiler';
import {
  createMockRuntime,
  createMockMessage,
  createMockState,
  createMockCallback,
} from '../test/mocks';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const mockTokens: TokenBalance[] = [
  { mint: SOL_MINT, symbol: 'SOL', amount: 10, usdValue: 1850 },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    amount: 1000,
    usdValue: 1000,
  },
];

const mockPriceMap = new Map<string, number>([[SOL_MINT, 185]]);

const mockPriceData: PriceData[] = [
  { mint: SOL_MINT, symbol: 'SOL', price: 185, change24h: 1.5 },
];

const kaminoPosition: Position = {
  protocol: 'kamino',
  type: 'lending',
  tokens: [{ mint: 'mint-kusdc', symbol: 'kUSDC', amount: 1000, usdValue: 1000 }],
  value: 1000,
  healthFactor: 2.0,
  liquidationPrice: null,
  pnl: 0,
  apy: 0.05,
  metadata: { mint: 'mint-kusdc' },
};

// ---------------------------------------------------------------------------
// Helper: set up default successful mocks
// ---------------------------------------------------------------------------

function setupSuccessMocks() {
  mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
  mockGetPrices.mockResolvedValueOnce(mockPriceMap);
  mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
  mockDriftGetPositions.mockResolvedValueOnce([]);
  mockMarginfiGetPositions.mockResolvedValueOnce([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzePortfolioAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- metadata ---

  it('has the correct name', () => {
    expect(analyzePortfolioAction.name).toBe('ANALYZE_PORTFOLIO');
  });

  it('similes includes PORTFOLIO and HEALTH', () => {
    expect(analyzePortfolioAction.similes).toContain('PORTFOLIO');
    expect(analyzePortfolioAction.similes).toContain('HEALTH');
  });

  it('has a description', () => {
    expect(typeof analyzePortfolioAction.description).toBe('string');
    expect(analyzePortfolioAction.description.length).toBeGreaterThan(0);
  });

  // --- validate ---

  describe('validate()', () => {
    const runtime = createMockRuntime();

    it('returns true for message containing "portfolio"', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('analyze my portfolio'))).toBe(true);
    });

    it('returns true for message containing "position"', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('what are my positions'))).toBe(true);
    });

    it('returns true for message containing "health"', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('Check health of my accounts'))).toBe(true);
    });

    it('returns true for message containing "risk"', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('What is my risk?'))).toBe(true);
    });

    it('returns true for message containing "how am i"', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('how am i doing?'))).toBe(true);
    });

    it('returns true for message containing "how\'s my"', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage("how's my strategy?"))).toBe(true);
    });

    it('returns true for message containing "analyze"', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('analyze everything'))).toBe(true);
    });

    it('returns false for unrelated message', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('What is the weather?'))).toBe(false);
    });

    it('is case-insensitive', async () => {
      expect(await analyzePortfolioAction.validate(runtime, createMockMessage('PORTFOLIO STATUS'))).toBe(true);
    });
  });

  // --- handler: missing config ---

  describe('handler() — missing config', () => {
    it('returns { success: false } when WALLET_ADDRESS is missing', async () => {
      const runtime = createMockRuntime({
        settings: { WALLET_ADDRESS: '', HELIUS_API_KEY: 'key-123' },
      });
      const callback = createMockCallback();

      const result = await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: false });
      expect(callback.calls.length).toBeGreaterThan(0);
      expect(callback.calls[0].text).toContain('not configured');
    });

    it('returns { success: false } when HELIUS_API_KEY is missing', async () => {
      const runtime = createMockRuntime({
        settings: { WALLET_ADDRESS: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr', HELIUS_API_KEY: '' },
      });
      const callback = createMockCallback();

      const result = await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: false });
      expect(callback.calls[0].text).toContain('not configured');
    });
  });

  // --- handler: success ---

  describe('handler() — success', () => {
    it('emits "Analyzing..." as first callback before results', async () => {
      setupSuccessMocks();
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      expect(callback.calls.length).toBeGreaterThanOrEqual(2);
      expect(callback.calls[0].text.toLowerCase()).toContain('analyz');
    });

    it('returns { success: true } with snapshot and result', async () => {
      setupSuccessMocks();
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: true });
      const data = (result as { success: true; data: { snapshot: unknown; result: unknown } }).data;
      expect(data.snapshot).toBeDefined();
      expect(data.result).toBeDefined();
    });

    it('final callback text contains analysis string from reasoning engine', async () => {
      setupSuccessMocks();
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      const lastCall = callback.calls[callback.calls.length - 1];
      expect(typeof lastCall.text).toBe('string');
      // The reasoning engine always produces an analysis string
      expect(lastCall.text.length).toBeGreaterThan(10);
    });

    it('final callback text includes recommendation from reasoning engine', async () => {
      setupSuccessMocks();
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      const lastCall = callback.calls[callback.calls.length - 1];
      // recommendation.action is always included in the output
      expect(lastCall.text.toLowerCase()).toMatch(/hold|reduce|monitor/);
    });

    it('calls getRiskProfile and passes the profile into buildPortfolioSnapshot', async () => {
      setupSuccessMocks();
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      // getRiskProfile must have been invoked so the snapshot includes learned tolerance
      expect(mockGetRiskProfile).toHaveBeenCalledOnce();
      // The handler should still succeed — the profile is wired through
      expect(result).toMatchObject({ success: true });
      const data = (result as { success: true; data: { snapshot: { riskProfile: unknown } } }).data;
      expect(data.snapshot.riskProfile).toMatchObject({ tolerance: 'moderate' });
    });

    it('calls all five services with correct wallet address', async () => {
      setupSuccessMocks();
      const runtime = createMockRuntime();
      const callback = createMockCallback();
      const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

      await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      expect(mockGetAssetsByOwner).toHaveBeenCalledWith(WALLET);
      expect(mockKaminoGetPositions).toHaveBeenCalledWith(WALLET);
      expect(mockDriftGetPositions).toHaveBeenCalledWith(WALLET);
      expect(mockMarginfiGetPositions).toHaveBeenCalledWith(WALLET);
    });
  });

  // --- handler: partial service failure ---

  describe('handler() — partial service failure', () => {
    it('succeeds even when Drift service throws', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);
      mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
      mockDriftGetPositions.mockRejectedValueOnce(new Error('Drift RPC timeout'));
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: true });
    });

    it('succeeds when all three protocol services throw', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);
      mockKaminoGetPositions.mockRejectedValueOnce(new Error('Kamino error'));
      mockDriftGetPositions.mockRejectedValueOnce(new Error('Drift error'));
      mockMarginfiGetPositions.mockRejectedValueOnce(new Error('Marginfi error'));

      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      // Still produces a result — positions default to []
      expect(result).toMatchObject({ success: true });
    });
  });

  // --- handler: getPrices call ---

  describe('handler() — Jupiter price integration', () => {
    it('calls getPrices with token mints from wallet', async () => {
      setupSuccessMocks();
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await analyzePortfolioAction.handler(
        runtime,
        createMockMessage('analyze portfolio'),
        createMockState(),
        {},
        callback,
      );

      // getPrices should have been called with at least the SOL mint
      expect(mockGetPrices).toHaveBeenCalledOnce();
      const calledWith = mockGetPrices.mock.calls[0][0] as string[];
      expect(Array.isArray(calledWith)).toBe(true);
      expect(calledWith).toContain(SOL_MINT);
    });
  });
});
