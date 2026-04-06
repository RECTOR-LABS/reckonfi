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
  const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

  let service: JupiterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JupiterService();
  });

  // -------------------------------------------------------------------------
  // getPrices
  // -------------------------------------------------------------------------

  describe('getPrices()', () => {
    it('calls Jupiter Price API v2 with comma-separated mint ids', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({
          data: {
            [SOL_MINT]: { price: '185.42' },
            [USDC_MINT]: { price: '1.0002' },
          },
        })
      );

      await service.getPrices([SOL_MINT, USDC_MINT]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(
        `https://api.jup.ag/price/v2?ids=${SOL_MINT},${USDC_MINT}`
      );
    });

    it('returns a Map with prices parsed as floats', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({
          data: {
            [SOL_MINT]: { price: '185.42' },
            [USDC_MINT]: { price: '1.0002' },
          },
        })
      );

      const prices = await service.getPrices([SOL_MINT, USDC_MINT]);

      expect(prices).toBeInstanceOf(Map);
      expect(prices.get(SOL_MINT)).toBeCloseTo(185.42, 5);
      expect(prices.get(USDC_MINT)).toBeCloseTo(1.0002, 5);
    });

    it('returns an empty Map when data object is empty', async () => {
      mockFetch.mockResolvedValueOnce(makeOkJson({ data: {} }));

      const prices = await service.getPrices([]);

      expect(prices).toBeInstanceOf(Map);
      expect(prices.size).toBe(0);
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
    const MOCK_ROUTE_PLAN = [
      { swapInfo: { label: 'Orca' } },
    ];

    function makeQuoteResponse(overrides?: Partial<Record<string, unknown>>) {
      return {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inAmount: '1000000000',
        outAmount: '184750000',
        slippageBps: 50,
        priceImpactPct: '0.003',
        routePlan: MOCK_ROUTE_PLAN,
        ...overrides,
      };
    }

    it('calls Jupiter Quote API v6 with correct query params', async () => {
      mockFetch.mockResolvedValueOnce(makeOkJson(makeQuoteResponse()));

      await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(
        `https://api.jup.ag/quote/v6?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=1000000000&slippageBps=50`
      );
    });

    it('returns a SwapQuote with all fields correctly mapped', async () => {
      mockFetch.mockResolvedValueOnce(makeOkJson(makeQuoteResponse()));

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(quote).toMatchObject<SwapQuote>({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inputAmount: 1_000_000_000,
        outputAmount: 184_750_000,
        slippage: 0.005,          // 50 bps / 10_000
        route: 'Orca',
        priceImpact: 0.003,
      });
    });

    it('maps inputAmount and outputAmount as integers from inAmount/outAmount strings', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson(makeQuoteResponse({ inAmount: '2500000000', outAmount: '462300000' }))
      );

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 2_500_000_000, 50);

      expect(Number.isInteger(quote.inputAmount)).toBe(true);
      expect(Number.isInteger(quote.outputAmount)).toBe(true);
      expect(quote.inputAmount).toBe(2_500_000_000);
      expect(quote.outputAmount).toBe(462_300_000);
    });

    it('computes slippage as bps / 10000', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson(makeQuoteResponse({ slippageBps: 100 }))
      );

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 100);

      expect(quote.slippage).toBeCloseTo(0.01, 6);
    });

    it('reads route from routePlan[0].swapInfo.label', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson(makeQuoteResponse({ routePlan: [{ swapInfo: { label: 'Raydium' } }] }))
      );

      const quote = await service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50);

      expect(quote.route).toBe('Raydium');
    });

    it('throws with "Jupiter Quote API error: {status}" on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(400));

      await expect(
        service.getQuote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
      ).rejects.toThrow('Jupiter Quote API error: 400');
    });
  });

  // -------------------------------------------------------------------------
  // getSwapTransaction
  // -------------------------------------------------------------------------

  describe('getSwapTransaction()', () => {
    const mockQuote: SwapQuote = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      inputAmount: 1_000_000_000,
      outputAmount: 184_750_000,
      slippage: 0.005,
      route: 'Orca',
      priceImpact: 0.003,
    };

    const ENCODED_TX = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAQADBase64encodedTransactionHere==';

    it('POSTs to Jupiter Swap v6 endpoint with quoteResponse and userPublicKey', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({ swapTransaction: ENCODED_TX })
      );

      await service.getSwapTransaction(mockQuote, WALLET);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.jup.ag/swap/v6');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.quoteResponse).toEqual(mockQuote);
      expect(body.userPublicKey).toBe(WALLET);
    });

    it('sends Content-Type: application/json header', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({ swapTransaction: ENCODED_TX })
      );

      await service.getSwapTransaction(mockQuote, WALLET);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('returns the swapTransaction string from the response', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkJson({ swapTransaction: ENCODED_TX })
      );

      const tx = await service.getSwapTransaction(mockQuote, WALLET);

      expect(tx).toBe(ENCODED_TX);
    });

    it('throws with "Jupiter Swap API error: {status}" on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(503));

      await expect(
        service.getSwapTransaction(mockQuote, WALLET)
      ).rejects.toThrow('Jupiter Swap API error: 503');
    });
  });
});
