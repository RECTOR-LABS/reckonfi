import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAgentRuntime } from '@elizaos/core';
import type { TokenBalance } from '../types/index';

// ---------------------------------------------------------------------------
// Mock HeliusService at module level (before SUT import)
// ---------------------------------------------------------------------------

const mockGetAssetsByOwner = vi.fn();

vi.mock('../services/helius.service', () => {
  const HeliusService = vi.fn(function (
    this: { getAssetsByOwner: typeof mockGetAssetsByOwner }
  ) {
    this.getAssetsByOwner = mockGetAssetsByOwner;
  });
  return { HeliusService };
});

// Import SUT after mocks are registered
import { checkBalanceAction } from './check-balance';
import {
  createMockRuntime,
  createMockMessage,
  createMockState,
  createMockCallback,
} from '../test/mocks';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

const mockTokens: TokenBalance[] = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    amount: 10,
    usdValue: 1850.0,
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    amount: 500,
    usdValue: 500.0,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkBalanceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- metadata ---

  it('has the correct name', () => {
    expect(checkBalanceAction.name).toBe('CHECK_BALANCE');
  });

  it('similes includes BALANCE and WALLET', () => {
    expect(checkBalanceAction.similes).toContain('BALANCE');
    expect(checkBalanceAction.similes).toContain('WALLET');
  });

  it('has a description', () => {
    expect(typeof checkBalanceAction.description).toBe('string');
    expect(checkBalanceAction.description.length).toBeGreaterThan(0);
  });

  // --- validate ---

  describe('validate()', () => {
    const runtime = {} as IAgentRuntime;

    it('returns true for message containing "balance"', async () => {
      const msg = createMockMessage('What is my balance?');
      expect(await checkBalanceAction.validate(runtime, msg)).toBe(true);
    });

    it('returns true for message containing "wallet"', async () => {
      const msg = createMockMessage('Show me my wallet');
      expect(await checkBalanceAction.validate(runtime, msg)).toBe(true);
    });

    it('returns true for message containing "holdings"', async () => {
      const msg = createMockMessage('Check my holdings');
      expect(await checkBalanceAction.validate(runtime, msg)).toBe(true);
    });

    it('returns true for message containing "how much"', async () => {
      const msg = createMockMessage('how much do I have?');
      expect(await checkBalanceAction.validate(runtime, msg)).toBe(true);
    });

    it('returns false for unrelated message', async () => {
      const msg = createMockMessage('What is the price of SOL?');
      expect(await checkBalanceAction.validate(runtime, msg)).toBe(false);
    });

    it('is case-insensitive for keyword matching', async () => {
      const msg = createMockMessage('BALANCE PLEASE');
      expect(await checkBalanceAction.validate(runtime, msg)).toBe(true);
    });
  });

  // --- handler: missing config ---

  describe('handler() — missing config', () => {
    it('calls callback with error text when WALLET_ADDRESS is missing', async () => {
      const runtime = createMockRuntime({
        settings: { WALLET_ADDRESS: '', HELIUS_API_KEY: 'key-123' },
      });
      const callback = createMockCallback();
      const result = await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: false });
      expect(callback.calls.length).toBeGreaterThan(0);
      expect(callback.calls[0].text).toContain('not configured');
      expect(mockGetAssetsByOwner).not.toHaveBeenCalled();
    });

    it('calls callback with error text when HELIUS_API_KEY is missing', async () => {
      const origKey = process.env.HELIUS_API_KEY; process.env.HELIUS_API_KEY = "";
      const runtime = createMockRuntime({
        settings: { WALLET_ADDRESS: WALLET, HELIUS_API_KEY: '' },
      });
      const callback = createMockCallback();
      const result = await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: false });
      expect(callback.calls[0].text).toContain('not configured');
      expect(mockGetAssetsByOwner).not.toHaveBeenCalled();
    });
  });

  // --- handler: success ---

  describe('handler() — success', () => {
    it('returns success with tokens and totalUSD', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: true });
      expect((result as { success: true; data: { tokens: TokenBalance[]; totalUSD: number } }).data.tokens).toHaveLength(2);
      expect((result as { success: true; data: { totalUSD: number } }).data.totalUSD).toBeCloseTo(2350, 0);
    });

    it('callback is called with wallet address in text', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      expect(callback.calls.length).toBeGreaterThan(0);
      expect(callback.calls[0].text).toContain(WALLET);
    });

    it('callback text includes SOL and USDC symbols', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      expect(callback.calls[0].text).toContain('SOL');
      expect(callback.calls[0].text).toContain('USDC');
    });

    it('sorts tokens by usdValue descending and caps at top 15', async () => {
      // 20 tokens — only top 15 should appear in result
      const manyTokens: TokenBalance[] = Array.from({ length: 20 }, (_, i) => ({
        mint: `Mint${i}`,
        symbol: `TKN${i}`,
        amount: i + 1,
        usdValue: (i + 1) * 10,
      }));

      mockGetAssetsByOwner.mockResolvedValueOnce(manyTokens);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      const data = (result as { success: true; data: { tokens: TokenBalance[]; totalUSD: number } }).data;
      expect(data.tokens).toHaveLength(15);
      // First token should be the highest-value one
      expect(data.tokens[0].usdValue).toBe(200); // TKN19: (20)*10 = 200
    });

    it('totalUSD reflects the sum of ALL fetched tokens (not just top 15)', async () => {
      const manyTokens: TokenBalance[] = Array.from({ length: 20 }, (_, i) => ({
        mint: `Mint${i}`,
        symbol: `TKN${i}`,
        amount: i + 1,
        usdValue: (i + 1) * 10,
      }));

      mockGetAssetsByOwner.mockResolvedValueOnce(manyTokens);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      // Sum of 10*1 + 10*2 + ... + 10*20 = 10 * (20*21/2) = 2100
      const data = (result as { success: true; data: { totalUSD: number } }).data;
      expect(data.totalUSD).toBeCloseTo(2100, 0);
    });
  });

  // --- handler: service error ---

  describe('handler() — service error', () => {
    it('returns { success: false } on HeliusService failure', async () => {
      mockGetAssetsByOwner.mockRejectedValueOnce(new Error('network timeout'));
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: false });
    });

    it('callback receives error message on service failure', async () => {
      mockGetAssetsByOwner.mockRejectedValueOnce(new Error('network timeout'));
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await checkBalanceAction.handler(
        runtime,
        createMockMessage('balance'),
        createMockState(),
        {},
        callback,
      );

      expect(callback.calls.length).toBeGreaterThan(0);
      expect(callback.calls[0].text).toContain('network timeout');
    });
  });
});
