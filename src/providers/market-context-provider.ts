import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { JupiterService } from '../services/jupiter.service';
import type { Trend, Volatility } from '../types/index';

// SOL native mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ---------------------------------------------------------------------------
// marketContextProvider
// ---------------------------------------------------------------------------

/**
 * ElizaOS provider that supplies market trend and volatility context.
 *
 * Phase 1: trend and volatility are simplified fixed values ('neutral',
 * 'moderate'). Phase 2 will integrate historical price data to derive
 * dynamic trend and volatility signals.
 */
export const marketContextProvider: Provider = {
  name: 'MARKET_CONTEXT_PROVIDER',
  description: 'Provides market trend and volatility context',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<{
    text: string;
    data: { trend: Trend; volatility: Volatility; solPrice: number };
  }> => {
    // Phase 1 constants — will be derived from historical data in Phase 2
    const trend: Trend = 'neutral';
    const volatility: Volatility = 'moderate';

    let solPrice = 0;

    try {
      const jupiter = new JupiterService();
      const priceMap = await jupiter.getPrices([SOL_MINT]);
      solPrice = priceMap.get(SOL_MINT) ?? 0;
    } catch {
      // Fallback: return safe defaults rather than throwing
      return {
        text: 'Market data unavailable.',
        data: { trend, volatility, solPrice: 0 },
      };
    }

    return {
      text: `Market Context: SOL $${solPrice.toFixed(2)} | Trend: ${trend} | Volatility: ${volatility}`,
      data: { trend, volatility, solPrice },
    };
  },
};
