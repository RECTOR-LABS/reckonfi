import type { SwapQuote } from '../types/index';

const JUPITER_BASE = 'https://api.jup.ag';

// ---------------------------------------------------------------------------
// Internal API response types
// ---------------------------------------------------------------------------

interface JupiterPriceV3Response {
  data: Record<string, { id: string; price: string; type: string } | null>;
}

interface JupiterUltraOrderResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
  otherAmountThreshold: string;
  swapType: string;
  transaction: string;
  requestId: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Jupiter API client for price lookups and swap quotes.
 *
 * Uses Jupiter Price API v3 and Ultra Swap API.
 * API key from portal.jup.ag is required for production use.
 */
export class JupiterService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.baseUrl = JUPITER_BASE;
    this.apiKey = apiKey ?? '';
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.apiKey) {
      h['x-api-key'] = this.apiKey;
    }
    return h;
  }

  /**
   * Fetches USD prices for a list of token mints using Jupiter Price API v3.
   */
  async getPrices(mints: string[]): Promise<Map<string, number>> {
    if (mints.length === 0) return new Map();

    const url = `${this.baseUrl}/price/v3?ids=${mints.join(',')}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Jupiter Price API error: ${response.status}`);
    }

    const data = (await response.json()) as JupiterPriceV3Response;

    const priceMap = new Map<string, number>();
    for (const [mint, entry] of Object.entries(data.data ?? {})) {
      if (entry && entry.price) {
        priceMap.set(mint, parseFloat(entry.price));
      }
    }

    return priceMap;
  }

  /**
   * Fetches a swap quote using Jupiter Ultra Swap API.
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    const url = `${this.baseUrl}/ultra/v1/order?${params}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Jupiter Quote API error: ${response.status}`);
    }

    const data = (await response.json()) as JupiterUltraOrderResponse;

    return {
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inputAmount: parseInt(data.inAmount, 10),
      outputAmount: parseInt(data.outAmount, 10),
      slippage: slippageBps / 10_000,
      route: data.swapType ?? 'ultra',
      priceImpact: parseFloat(data.priceImpactPct ?? '0'),
    };
  }

  /**
   * Executes a signed swap transaction via Jupiter Ultra.
   */
  async executeSwap(
    signedTransaction: string,
    requestId: string
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/ultra/v1/execute`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction, requestId }),
    });

    if (!response.ok) {
      throw new Error(`Jupiter Swap API error: ${response.status}`);
    }

    const data = (await response.json()) as { signature: string };
    return data.signature;
  }
}
