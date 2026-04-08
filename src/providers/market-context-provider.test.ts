import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';

// ---------------------------------------------------------------------------
// Mock JupiterService at module level (before SUT import)
// ---------------------------------------------------------------------------

const mockGetPrices = vi.fn();

vi.mock('../services/jupiter.service', () => {
  const JupiterService = vi.fn(function (
    this: { getPrices: typeof mockGetPrices }
  ) {
    this.getPrices = mockGetPrices;
  });
  return { JupiterService };
});

// Import SUT after mocks are registered
import { marketContextProvider } from './market-context-provider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const dummyRuntime = {} as IAgentRuntime;
const dummyMessage = {} as Memory;
const dummyState = {} as State;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('marketContextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has the correct name and description', () => {
    expect(marketContextProvider.name).toBe('MARKET_CONTEXT_PROVIDER');
    expect(marketContextProvider.description.toLowerCase()).toContain('market');
  });

  describe('get()', () => {
    it('returns text containing "Market Context:"', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toContain('Market Context:');
    });

    it('returns text containing the SOL price', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toContain('185.42');
    });

    it('returns text containing trend', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text.toLowerCase()).toContain('trend:');
    });

    it('returns text containing volatility', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text.toLowerCase()).toContain('volatility:');
    });

    it('data includes trend and volatility fields', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.trend).toBeDefined();
      expect(result.data.volatility).toBeDefined();
    });

    it('data.trend is "neutral" in Phase 1', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.trend).toBe('neutral');
    });

    it('data.volatility is "moderate" in Phase 1', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.volatility).toBe('moderate');
    });

    it('data.solPrice matches the value returned by Jupiter', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.solPrice).toBeCloseTo(185.42, 2);
    });

    it('calls JupiterService.getPrices with the SOL mint', async () => {
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(mockGetPrices).toHaveBeenCalledTimes(1);
      const [mints] = mockGetPrices.mock.calls[0] as [string[]];
      expect(mints).toContain(SOL_MINT);
    });

    it('returns fallback data on JupiterService failure', async () => {
      mockGetPrices.mockRejectedValueOnce(new Error('Jupiter API unavailable'));

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toBe('Market data unavailable.');
      expect(result.data.trend).toBe('neutral');
      expect(result.data.volatility).toBe('moderate');
      expect(result.data.solPrice).toBe(0);
    });

    it('defaults solPrice to 0 when SOL mint is absent from Jupiter response', async () => {
      // Jupiter returns an empty map — SOL price missing
      mockGetPrices.mockResolvedValueOnce(new Map<string, number>());

      const result = await marketContextProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.solPrice).toBe(0);
    });
  });
});
