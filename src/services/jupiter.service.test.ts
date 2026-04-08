import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JupiterService } from './jupiter.service';
import type { SwapQuote } from '../types/index';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Response factories
// ---------------------------------------------------------------------------

function makeOkJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function makeErrorResponse(status: number) {
  return { ok: false, status };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JupiterService', () => {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  let service: JupiterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JupiterService();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('accepts no arguments', () => {
      expect(() => new JupiterService()).not.toThrow();
    });

    it('accepts an optional apiKey argument', () => {
      expect(() => new JupiterService('test-api-key')).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getPrices
  // -------------------------------------------------------------------------

  describe('getPrices()', () => {
    it('calls Jupiter Price API v3 with comma-separated mint ids', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({
          data: {
            [SOL_MINT]: { id: SOL_MINT, price: '185.42', type: 'derivedPrice' },
            [USDC_MINT]: { id: USDC_MINT, price: '1.0002', type: 'derivedPrice' },
          },
        })
      );

      await service.getPrices([SOL_MINT, USDC_MINT]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(
        `https://api.jup.ag/price/v3?ids=${SOL_MINT},${USDC_MINT}`
      );
    });

    it('returns a Map with prices parsed as floats', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({
          data: {
            [SOL_MINT]: { id: SOL_MINT, price: '185.42', type: 'derivedPrice' },
            [USDC_MINT]: { id: USDC_MINT, price: '1.0002', type: 'derivedPrice' },
          },
        })
      );

      const prices = await service.getPrices([SOL_MINT, USDC_MINT]);

      expect(prices).toBeInstanceOf(Map);
      expect(prices.get(SOL_MINT)).toBeCloseTo(185.42, 5);
      expect(prices.get(USDC_MINT)).toBeCloseTo(1.0002, 5);
    });

    it('returns an empty Map when called with an empty array (no fetch)', async () => {
      const prices = await service.getPrices([]);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(prices).toBeInstanceOf(Map);
      expect(prices.size).toBe(0);
    });

    it('skips null entries in v3 data without throwing', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({
          data: {
            [SOL_MINT]: { id: SOL_MINT, price: '185.42', type: 'derivedPrice' },
            [USDC_MINT]: null,
          },
        })
      );

      const prices = await service.getPrices([SOL_MINT, USDC_MINT]);

      expect(prices.get(SOL_MINT)).toBeCloseTo(185.42, 5);
      expect(prices.has(USDC_MINT)).toBe(false);
    });

    it('throws with "Jupiter Price API error: {status}" on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(429));

      await expect(service.getPrices([SOL_MINT])).rejects.toThrow(
        'Jupiter Price API error: 429'
      );
    });

    it('throws with correct status code on 500', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500));

      await expect(service.getPrices([SOL_MINT])).rejects.toThrow(
        'Jupiter Price API error: 500'
      );
    });
  });

  // -------------------------------------------------------------------------
  // getQuote
  // -------------------------------------------------------------------------

  describe('getQuote()', () => {
    function makeUltraOrderResponse(overrides?: Partial<Record<string, unknown>>) {
      return {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inAmount: '1000000000',
        outAmount: '184750000',
        otherAmountThreshold: '183902500',
        priceImpactPct: '0.003',
        swapType: 'ultra',
        transaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAABase64==',
        requestId: 'req-abc-123',
        ...overrides,
      };
    }

    it('calls Jupiter Ultra Order endpoint with correct query params', async () => {
      mockFetch.mockResolvedValueOnce(makeOkJson(makeUltraOrderResponse()));

      await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(
        `https://api.jup.ag/ultra/v1/order?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=1000000000&slippageBps=50`
      );
    });

    it('returns a SwapQuote with all fields correctly mapped', async () => {
      mockFetch.mockResolvedValueOnce(makeOkJson(makeUltraOrderResponse()));

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(quote).toMatchObject<SwapQuote>({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1_000_000_000,
        outputAmount: 184_750_000,
        slippage: 0.005,          // 50 bps / 10_000
        route: 'ultra',
        priceImpact: 0.003,
      });
    });

    it('maps inputAmount and outputAmount as integers from inAmount/outAmount strings', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson(makeUltraOrderResponse({ inAmount: '2500000000', outAmount: '462300000' }))
      );

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 2_500_000_000, 50);

      expect(Number.isInteger(quote.inputAmount)).toBe(true);
      expect(Number.isInteger(quote.outputAmount)).toBe(true);
      expect(quote.inputAmount).toBe(2_500_000_000);
      expect(quote.outputAmount).toBe(462_300_000);
    });

    it('computes slippage as bps / 10000', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson(makeUltraOrderResponse())
      );

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 100);

      expect(quote.slippage).toBeCloseTo(0.01, 6);
    });

    it('reads route from swapType field', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson(makeUltraOrderResponse({ swapType: 'aggregator' }))
      );

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(quote.route).toBe('aggregator');
    });

    it('defaults route to "ultra" when swapType is absent', async () => {
      const response = makeUltraOrderResponse();
      delete (response as Record<string, unknown>).swapType;

      mockFetch.mockResolvedValueOnce(makeOkJson(response));

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(quote.route).toBe('ultra');
    });

    it('defaults priceImpact to 0 when priceImpactPct is absent', async () => {
      const response = makeUltraOrderResponse();
      delete (response as Record<string, unknown>).priceImpactPct;

      mockFetch.mockResolvedValueOnce(makeOkJson(response));

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(quote.priceImpact).toBe(0);
    });

    it('throws with "Jupiter Quote API error: {status}" on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(400));

      await expect(
        service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
      ).rejects.toThrow('Jupiter Quote API error: 400');
    });
  });

  // -------------------------------------------------------------------------
  // executeSwap
  // -------------------------------------------------------------------------

  describe('executeSwap()', () => {
    const SIGNED_TX = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAQADBase64SignedTx==';
    const REQUEST_ID = 'req-abc-123';
    const SIGNATURE = '5J3mBbAH58cDDGq4LDWMQ2JGvFkpFV6TXvSdMhHVhFJU7NJmkNH7L9TtxhqSdNmMHGy8iL8e1Kvb3xPcnJDzKsV';

    it('POSTs to Jupiter Ultra execute endpoint with signedTransaction and requestId', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({ signature: SIGNATURE })
      );

      await service.executeSwap(SIGNED_TX, REQUEST_ID);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.jup.ag/ultra/v1/execute');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.signedTransaction).toBe(SIGNED_TX);
      expect(body.requestId).toBe(REQUEST_ID);
    });

    it('sends Content-Type: application/json header', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({ signature: SIGNATURE })
      );

      await service.executeSwap(SIGNED_TX, REQUEST_ID);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('returns the transaction signature string from the response', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({ signature: SIGNATURE })
      );

      const sig = await service.executeSwap(SIGNED_TX, REQUEST_ID);

      expect(sig).toBe(SIGNATURE);
    });

    it('throws with "Jupiter Swap API error: {status}" on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(503));

      await expect(
        service.executeSwap(SIGNED_TX, REQUEST_ID)
      ).rejects.toThrow('Jupiter Swap API error: 503');
    });
  });
});
