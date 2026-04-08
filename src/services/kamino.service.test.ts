import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KaminoService } from './kamino.service';
import type { Position } from '../types/index';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// DAS API response factories
// ---------------------------------------------------------------------------

function makeDasResponse(items: unknown[]) {
  return {
    ok: true,
    json: async () => ({ result: { items } }),
  };
}

/**
 * Builds a minimal DAS asset that does NOT look like a Kamino position
 * (no authorities array referencing KLend).
 */
function makeNonKaminoAsset() {
  return {
    id: 'SomeMint111111111111111111111111111111111111',
    token_info: {
      balance: 1_000_000,
      decimals: 6,
      symbol: 'USDC',
      price_info: { price_per_token: 1.0 },
    },
    authorities: [
      { address: 'RandomAuthority1111111111111111111111111111', scopes: ['full'] },
    ],
  };
}

/**
 * Builds a DAS asset that looks like a Kamino lending position.
 * The first authority address starts with 'KLend' which is the Kamino
 * lending program marker.
 */
function makeKaminoAsset(overrides: {
  mint?: string;
  symbol?: string;
  balance?: number;
  decimals?: number;
  price_per_token?: number;
} = {}) {
  const {
    mint = 'KaminoMint11111111111111111111111111111111111',
    symbol = 'kUSDC',
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
    // Authorities include an address starting with 'KLend' — the Kamino marker
    authorities: [
      { address: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', scopes: ['full'] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KaminoService', () => {
  const API_KEY = 'mock-helius-api-key';
  const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // No positions case
  // -------------------------------------------------------------------------

  describe('getPositions() — wallet with no Kamino positions', () => {
    it('returns empty array when DAS returns no items', async () => {
      mockFetch.mockResolvedValueOnce(makeDasResponse([]));

      const service = new KaminoService(API_KEY);
      const positions = await service.getPositions(WALLET);

      expect(positions).toEqual([]);
    });

    it('returns empty array when all assets lack a KLend authority', async () => {
      mockFetch.mockResolvedValueOnce(makeDasResponse([makeNonKaminoAsset()]));

      const service = new KaminoService(API_KEY);
      const positions = await service.getPositions(WALLET);

      expect(positions).toEqual([]);
    });

    it('returns empty array when items have no token_info', async () => {
      const noTokenInfo = {
        id: 'NftMint111111111111111111111111111111111111111',
        token_info: null,
        authorities: [
          { address: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', scopes: ['full'] },
        ],
      };
      mockFetch.mockResolvedValueOnce(makeDasResponse([noTokenInfo]));

      const service = new KaminoService(API_KEY);
      const positions = await service.getPositions(WALLET);

      expect(positions).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Kamino position parsing
  // -------------------------------------------------------------------------

  describe('getPositions() — wallet with a Kamino position', () => {
    it('parses a single Kamino asset into a Position', async () => {
      const asset = makeKaminoAsset({ balance: 2_000_000, decimals: 6, price_per_token: 0.5 });
      mockFetch.mockResolvedValueOnce(makeDasResponse([asset]));

      const service = new KaminoService(API_KEY);
      const positions = await service.getPositions(WALLET);

      expect(positions).toHaveLength(1);
      const pos = positions[0] as Position;

      // Protocol and type
      expect(pos.protocol).toBe('kamino');
      expect(pos.type).toBe('lending');

      // Token parsing: amount = 2_000_000 / 10^6 = 2, usdValue = 2 * 0.5 = 1
      expect(pos.tokens).toHaveLength(1);
      expect(pos.tokens[0]!.mint).toBe(asset.id);
      expect(pos.tokens[0]!.symbol).toBe('kUSDC');
      expect(pos.tokens[0]!.amount).toBeCloseTo(2, 6);
      expect(pos.tokens[0]!.usdValue).toBeCloseTo(1, 6);

      // value = sum of token USD values
      expect(pos.value).toBeCloseTo(1, 6);

      // Phase 1: health factor and liquidation price not yet computed
      expect(pos.healthFactor).toBeNull();
      expect(pos.liquidationPrice).toBeNull();

      // Default numeric fields
      expect(pos.pnl).toBe(0);
      expect(pos.apy).toBe(0);

      // metadata carries the raw mint id
      expect(pos.metadata).toMatchObject({ mint: asset.id });
    });

    it('filters out non-Kamino assets and keeps only Kamino ones', async () => {
      const kaminoAsset = makeKaminoAsset({ symbol: 'kSOL', price_per_token: 150 });
      const regularAsset = makeNonKaminoAsset();
      mockFetch.mockResolvedValueOnce(makeDasResponse([regularAsset, kaminoAsset]));

      const service = new KaminoService(API_KEY);
      const positions = await service.getPositions(WALLET);

      expect(positions).toHaveLength(1);
      expect(positions[0]!.tokens[0]!.symbol).toBe('kSOL');
    });

    it('maps multiple Kamino assets to multiple positions', async () => {
      const asset1 = makeKaminoAsset({ mint: 'KaminoMint1111111111111111111111111111111111', symbol: 'kUSDC' });
      const asset2 = makeKaminoAsset({ mint: 'KaminoMint2222222222222222222222222222222222', symbol: 'kSOL', price_per_token: 150 });
      mockFetch.mockResolvedValueOnce(makeDasResponse([asset1, asset2]));

      const service = new KaminoService(API_KEY);
      const positions = await service.getPositions(WALLET);

      expect(positions).toHaveLength(2);
      expect(positions.every(p => p.protocol === 'kamino')).toBe(true);
      expect(positions.every(p => p.type === 'lending')).toBe(true);
    });

    it('computes position value as sum of token USD values', async () => {
      const asset = makeKaminoAsset({ balance: 5_000_000, decimals: 6, price_per_token: 2.0 });
      mockFetch.mockResolvedValueOnce(makeDasResponse([asset]));

      const service = new KaminoService(API_KEY);
      const positions = await service.getPositions(WALLET);

      // amount = 5, price = 2, value = 10
      expect(positions[0]!.value).toBeCloseTo(10, 6);
    });
  });

  // -------------------------------------------------------------------------
  // DAS RPC call shape
  // -------------------------------------------------------------------------

  describe('getPositions() — DAS call shape', () => {
    it('calls Helius DAS endpoint with getAssetsByOwner payload', async () => {
      mockFetch.mockResolvedValueOnce(makeDasResponse([]));

      const service = new KaminoService(API_KEY);
      await service.getPositions(WALLET);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`https://mainnet.helius-rpc.com/?api-key=${API_KEY}`);
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string);
      expect(body.method).toBe('getAssetsByOwner');
      expect(body.params.ownerAddress).toBe(WALLET);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('getPositions() — error handling', () => {
    it('throws when Helius returns a non-ok HTTP response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const service = new KaminoService(API_KEY);
      await expect(service.getPositions(WALLET)).rejects.toThrow('Helius API error: 503');
    });
  });
});
