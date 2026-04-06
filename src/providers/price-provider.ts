import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { JupiterService } from '../services/jupiter.service';
import type { PriceData } from '../types/index';

// ---------------------------------------------------------------------------
// Tracked tokens (Phase 1)
// ---------------------------------------------------------------------------

const TRACKED_TOKENS: { mint: string; symbol: string }[] = [
  { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
  { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', symbol: 'mSOL' },
  { mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', symbol: 'jitoSOL' },
];

/**
 * ElizaOS provider that fetches current token prices via Jupiter Price API v2.
 *
 * Tracks a fixed set of key Solana DeFi tokens (SOL, USDC, USDT, mSOL, jitoSOL).
 * 24-hour change is set to 0 in Phase 1 — will be populated once a price-history
 * source is integrated.
 */
export const priceProvider: Provider = {
  name: 'PRICE_PROVIDER',
  description: 'Provides current token prices from Jupiter',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<{ text: string; data: { prices: PriceData[] } }> => {
    const jupiter = new JupiterService();
    const mints = TRACKED_TOKENS.map((t) => t.mint);
    const priceMap = await jupiter.getPrices(mints);

    const prices: PriceData[] = TRACKED_TOKENS.map(({ mint, symbol }) => ({
      mint,
      symbol,
      price: priceMap.get(mint) ?? 0,
      change24h: 0, // Phase 1: price-history source not yet integrated
    }));

    const lines = prices
      .map((p) => `  ${p.symbol}: $${p.price.toFixed(4)}`)
      .join('\n');

    return {
      text: `Token Prices:\n${lines}`,
      data: { prices },
    };
  },
};
