import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type { TokenBalance } from '../types/index';

// ---------------------------------------------------------------------------
// Mock HeliusService at module level (before any imports of the SUT)
// ---------------------------------------------------------------------------

const mockGetAssetsByOwner = vi.fn();

vi.mock('../services/helius.service', () => {
  const HeliusService = vi.fn(function (this: { getAssetsByOwner: typeof mockGetAssetsByOwner }) {
    this.getAssetsByOwner = mockGetAssetsByOwner;
  });
  return { HeliusService };
});

// Import the SUT after mocks are registered
import { walletProvider } from './wallet-provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

function makeRuntime(
  settings: Record<string, string | undefined> = {}
): IAgentRuntime {
  return {
    getSetting: vi.fn((key: string) => settings[key] ?? null),
  } as unknown as IAgentRuntime;
}

const dummyMessage = {} as Memory;
const dummyState = {} as State;

const mockTokens: TokenBalance[] = [
  { mint: SOL_MINT, symbol: 'SOL', amount: 5.0, usdValue: 925.0 },
  { mint: USDC_MINT, symbol: 'USDC', amount: 1000.0, usdValue: 1000.0 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('walletProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has the correct name and description', () => {
    expect(walletProvider.name).toBe('WALLET_PROVIDER');
    expect(walletProvider.description).toContain('wallet');
  });

  describe('get()', () => {
    it('returns not-configured message when WALLET_ADDRESS is missing', async () => {
      const runtime = makeRuntime({ HELIUS_API_KEY: 'key-123' });
      const result = await walletProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain('Wallet not configured');
      expect(result.data).toBeNull();
      expect(mockGetAssetsByOwner).not.toHaveBeenCalled();
    });

    it('returns not-configured message when HELIUS_API_KEY is missing', async () => {
      const runtime = makeRuntime({ WALLET_ADDRESS: WALLET });
      const result = await walletProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain('Wallet not configured');
      expect(result.data).toBeNull();
      expect(mockGetAssetsByOwner).not.toHaveBeenCalled();
    });

    it('returns wallet data with SOL and USDC tokens', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await walletProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain(WALLET);
      expect(result.text).toContain('SOL');
      expect(result.text).toContain('USDC');
      expect(result.data).toBeDefined();
    });

    it('result data includes tokens array and totalUSD', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await walletProvider.get(runtime, dummyMessage, dummyState);

      expect(result.data).not.toBeNull();
      expect(result.data.tokens).toHaveLength(2);
      expect(result.data.totalUSD).toBeCloseTo(1925.0, 2);
      expect(result.data.walletAddress).toBe(WALLET);
    });

    it('result data includes walletAddress', async () => {
      mockGetAssetsByOwner.mockResolvedValueOnce(mockTokens);
      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await walletProvider.get(runtime, dummyMessage, dummyState);
      expect(result.data.walletAddress).toBe(WALLET);
    });

    it('sorts tokens by usdValue descending and caps at top 10', async () => {
      // 12 tokens — only top 10 should be returned
      const manyTokens: TokenBalance[] = Array.from({ length: 12 }, (_, i) => ({
        mint: `Mint${i}`,
        symbol: `TKN${i}`,
        amount: i + 1,
        usdValue: (i + 1) * 10, // ascending usd values
      }));

      mockGetAssetsByOwner.mockResolvedValueOnce(manyTokens);
      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await walletProvider.get(runtime, dummyMessage, dummyState);

      // Top 10 should be indices 11..2 (highest usdValues)
      expect(result.data.tokens).toHaveLength(10);
      // First token should have the highest usdValue (120)
      expect(result.data.tokens[0].usdValue).toBe(120);
    });

    it('returns error message on HeliusService failure', async () => {
      mockGetAssetsByOwner.mockRejectedValueOnce(new Error('network timeout'));
      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await walletProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain('Failed to fetch wallet');
      expect(result.text).toContain('network timeout');
      expect(result.data).toBeNull();
    });
  });
});
