import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeliusService } from './helius.service';
import type { TokenBalance } from '../types/index';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// DAS API response factory
// ---------------------------------------------------------------------------

function makeDasResponse(items: unknown[]) {
  return {
    ok: true,
    json: async () => ({ result: { items } }),
  };
}

function makeAssetItem(overrides: {
  mint?: string;
  symbol?: string;
  balance?: number;
  decimals?: number;
  price_per_token?: number;
}) {
  const {
    mint = 'TokenMint111111111111111111111111111111111111',
    symbol = 'TKN',
    balance = 1_000_000,
    decimals = 6,
    price_per_token = 1.0,
  } = overrides;

  return {
    id: mint,
    token_info: {
      balance,
      decimals,
      symbol,
      price_info: { price_per_token },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeliusService', () => {
  const API_KEY = 'mock-helius-api-key';
  const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getAssetsByOwner
  // -------------------------------------------------------------------------

  describe('getAssetsByOwner()', () => {
    it('calls Helius DAS RPC endpoint with correct payload', async () => {
      mockFetch.mockResolvedValueOnce(makeDasResponse([]));

      const service = new HeliusService(API_KEY);
      await service.getAssetsByOwner(WALLET);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`https://mainnet.helius-rpc.com/?api-key=${API_KEY}`);
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body as string);
      expect(body.method).toBe('getAssetsByOwner');
      expect(body.params.ownerAddress).toBe(WALLET);
    });

    it('maps DAS items to TokenBalance correctly', async () => {
      const item = makeAssetItem({ balance: 2_000_000, decimals: 6, price_per_token: 0.5 });
      mockFetch.mockResolvedValueOnce(makeDasResponse([item]));

      const service = new HeliusService(API_KEY);
      const balances = await service.getAssetsByOwner(WALLET);

      expect(balances).toHaveLength(1);
      const token = balances[0] as TokenBalance;
      expect(token.mint).toBe(item.id);
      expect(token.symbol).toBe('TKN');
      // amount = 2_000_000 / 10^6 = 2
      expect(token.amount).toBeCloseTo(2, 6);
      // usdValue = 2 * 0.5 = 1
      expect(token.usdValue).toBeCloseTo(1, 6);
    });

    it('filters out items with zero balance', async () => {
      const zeroItem = makeAssetItem({ balance: 0 });
      const nonZeroItem = makeAssetItem({
        mint: 'AnotherMint11111111111111111111111111111111',
        symbol: 'ABC',
        balance: 5_000_000,
        decimals: 6,
        price_per_token: 2.0,
      });
      mockFetch.mockResolvedValueOnce(makeDasResponse([zeroItem, nonZeroItem]));

      const service = new HeliusService(API_KEY);
      const balances = await service.getAssetsByOwner(WALLET);

      expect(balances).toHaveLength(1);
      expect(balances[0]!.mint).toBe('AnotherMint11111111111111111111111111111111');
    });

    it('returns empty array when no items have balance', async () => {
      mockFetch.mockResolvedValueOnce(makeDasResponse([]));

      const service = new HeliusService(API_KEY);
      const balances = await service.getAssetsByOwner(WALLET);

      expect(balances).toEqual([]);
    });

    it('handles items missing token_info by filtering them out', async () => {
      const noTokenInfo = { id: 'NftMint111111', token_info: null };
      const valid = makeAssetItem({ balance: 1_000_000 });
      mockFetch.mockResolvedValueOnce(makeDasResponse([noTokenInfo, valid]));

      const service = new HeliusService(API_KEY);
      const balances = await service.getAssetsByOwner(WALLET);

      expect(balances).toHaveLength(1);
    });

    it('throws on non-ok HTTP response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

      const service = new HeliusService(API_KEY);
      await expect(service.getAssetsByOwner(WALLET)).rejects.toThrow('Helius API error: 429');
    });
  });

  // -------------------------------------------------------------------------
  // getTransactionHistory
  // -------------------------------------------------------------------------

  describe('getTransactionHistory()', () => {
    it('calls the correct Helius REST endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ signature: 'abc123' }],
      });

      const service = new HeliusService(API_KEY);
      const txs = await service.getTransactionHistory(WALLET);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain(`https://api.helius.xyz/v0/addresses/${WALLET}/transactions`);
      expect(url).toContain(`api-key=${API_KEY}`);
      expect(txs).toHaveLength(1);
    });

    it('respects the optional limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const service = new HeliusService(API_KEY);
      await service.getTransactionHistory(WALLET, 25);

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain('limit=25');
    });

    it('uses a default limit when none is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const service = new HeliusService(API_KEY);
      await service.getTransactionHistory(WALLET);

      const [url] = mockFetch.mock.calls[0] as [string];
      // Should include a limit parameter (whatever the default is)
      expect(url).toMatch(/limit=\d+/);
    });

    it('throws on non-ok HTTP response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

      const service = new HeliusService(API_KEY);
      await expect(service.getTransactionHistory(WALLET)).rejects.toThrow('Helius API error: 429');
    });
  });
});
