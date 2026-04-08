import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';

// ---------------------------------------------------------------------------
// Mock JupiterService at module level (before any imports of the SUT)
// ---------------------------------------------------------------------------

const mockGetPrices = vi.fn();

vi.mock('../services/jupiter.service', () => {
  const JupiterService = vi.fn(function (this: { getPrices: typeof mockGetPrices }) {
    this.getPrices = mockGetPrices;
  });
  return { JupiterService };
});

// Import the SUT after mocks are registered
import { priceProvider } from './price-provider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const MSOL_MINT = 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So';
const JITOSOL_MINT = 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn';

const mockGetSetting = vi.fn().mockReturnValue(null);
const dummyRuntime = {
  getSetting: mockGetSetting,
} as unknown as IAgentRuntime;
const dummyMessage = {} as Memory;
const dummyState = {} as State;

const mockPriceMap = new Map<string, number>([
  [SOL_MINT, 185.42],
  [USDC_MINT, 1.0001],
  [USDT_MINT, 0.9999],
  [MSOL_MINT, 192.3],
  [JITOSOL_MINT, 193.1],
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('priceProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSetting.mockReturnValue(null);
  });

  it('has the correct name and description', () => {
    expect(priceProvider.name).toBe('PRICE_PROVIDER');
    expect(priceProvider.description).toContain('price');
  });

  describe('get()', () => {
    it('returns a text string starting with "Token Prices:"', async () => {
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);

      const result = await priceProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toMatch(/^Token Prices:/);
    });

    it('result data contains prices array', async () => {
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);

      const result = await priceProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data).toBeDefined();
      expect(result.data.prices).toBeDefined();
      expect(Array.isArray(result.data.prices)).toBe(true);
    });

    it('prices array has one entry per tracked mint', async () => {
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);

      const result = await priceProvider.get(dummyRuntime, dummyMessage, dummyState);

      // 5 tracked mints: SOL, USDC, USDT, mSOL, jitoSOL
      expect(result.data.prices).toHaveLength(5);
    });

    it('each PriceData entry has mint, symbol, price, and change24h: 0', async () => {
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);

      const result = await priceProvider.get(dummyRuntime, dummyMessage, dummyState);

      for (const entry of result.data.prices) {
        expect(entry).toMatchObject({
          mint: expect.any(String),
          symbol: expect.any(String),
          price: expect.any(Number),
          change24h: 0,
        });
      }
    });

    it('includes SOL price in the response text', async () => {
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);

      const result = await priceProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toContain('SOL');
      expect(result.text).toContain('185.42');
    });

    it('calls JupiterService.getPrices with all 5 tracked mint addresses', async () => {
      mockGetPrices.mockResolvedValueOnce(mockPriceMap);

      await priceProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(mockGetPrices).toHaveBeenCalledTimes(1);
      const [mints] = mockGetPrices.mock.calls[0] as [string[]];
      expect(mints).toContain(SOL_MINT);
      expect(mints).toContain(USDC_MINT);
      expect(mints).toContain(USDT_MINT);
      expect(mints).toContain(MSOL_MINT);
      expect(mints).toContain(JITOSOL_MINT);
      expect(mints).toHaveLength(5);
    });

    it('handles mints not returned by Jupiter (price defaults to 0)', async () => {
      // Only SOL returned
      mockGetPrices.mockResolvedValueOnce(new Map([[SOL_MINT, 185.42]]));

      const result = await priceProvider.get(dummyRuntime, dummyMessage, dummyState);

      // Should still return 5 entries, missing ones default to price 0
      expect(result.data.prices).toHaveLength(5);
      const usdc = result.data.prices.find(
        (p: { mint: string }) => p.mint === USDC_MINT
      );
      expect(usdc?.price).toBe(0);
    });
  });
});
