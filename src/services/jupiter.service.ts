import type { SwapQuote } from '../types/index';

const JUPITER_BASE = 'https://api.jup.ag';

// ---------------------------------------------------------------------------
// Internal API response types
// ---------------------------------------------------------------------------

interface JupiterPriceV2Response {
  data: Record<string, { price: string }>;
}

interface JupiterRoutePlanStep {
  swapInfo: { label: string };
}

interface JupiterQuoteV6Response {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRoutePlanStep[];
}

interface JupiterSwapV6Response {
  swapTransaction: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Jupiter API client for price lookups, swap quotes, and swap transactions.
 *
 * Uses Jupiter Price API v2, Quote API v6, and Swap API v6.
 */
export class JupiterService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = JUPITER_BASE;
  }

  /**
   * Fetches USD prices for a list of token mints using Jupiter Price API v2.
   *
   * @param mints - Array of Solana token mint addresses.
   * @returns Map of mint address → price as float.
   * @throws On non-2xx HTTP response.
   */
  async getPrices(mints: string[]): Promise<Map<string, number>> {
    const url = `${this.baseUrl}/price/v2?ids=${mints.join(',')}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Jupiter Price API error: ${response.status}`);
    }

    const data = (await response.json()) as JupiterPriceV2Response;

    const priceMap = new Map<string, number>();
    for (const [mint, entry] of Object.entries(data.data)) {
      priceMap.set(mint, parseFloat(entry.price));
    }

    return priceMap;
  }

  /**
   * Fetches a swap quote between two tokens using Jupiter Quote API v6.
   *
   * @param inputMint - Source token mint address.
   * @param outputMint - Destination token mint address.
   * @param amount - Input amount in raw token units (integer).
   * @param slippageBps - Slippage tolerance in basis points.
   * @returns Parsed SwapQuote object.
   * @throws On non-2xx HTTP response.
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<SwapQuote> {
    const url =
      `${this.baseUrl}/quote/v6` +
      `?inputMint=${inputMint}` +
      `&outputMint=${outputMint}` +
      `&amount=${amount}` +
      `&slippageBps=${slippageBps}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Jupiter Quote API error: ${response.status}`);
    }

    const data = (await response.json()) as JupiterQuoteV6Response;

    return {
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inputAmount: parseInt(data.inAmount, 10),
      outputAmount: parseInt(data.outAmount, 10),
      slippage: data.slippageBps / 10_000,
      route: data.routePlan[0]!.swapInfo.label,
      priceImpact: parseFloat(data.priceImpactPct),
    };
  }

  /**
   * Fetches a serialized swap transaction from Jupiter Swap API v6.
   *
   * @param quoteResponse - The SwapQuote returned by getQuote().
   * @param userPublicKey - The user's Solana wallet public key (base58).
   * @returns Base64-encoded serialized transaction string.
   * @throws On non-2xx HTTP response.
   */
  async getSwapTransaction(
    quoteResponse: SwapQuote,
    userPublicKey: string
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/swap/v6`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse, userPublicKey }),
    });

    if (!response.ok) {
      throw new Error(`Jupiter Swap API error: ${response.status}`);
    }

    const data = (await response.json()) as JupiterSwapV6Response;

    return data.swapTransaction;
  }
}
