import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { HeliusService } from '../services/helius.service';
import { getWalletOverride } from '../actions/set-wallet';
import type { TokenBalance } from '../types/index';

const TOP_TOKENS_LIMIT = 10;

/**
 * ElizaOS provider that fetches and formats the agent's wallet balances.
 *
 * Reads WALLET_ADDRESS and HELIUS_API_KEY from runtime settings, queries the
 * Helius DAS API for all token holdings, and returns the top 10 positions by
 * USD value alongside a formatted text summary.
 */
export const walletProvider: Provider = {
  name: 'WALLET_PROVIDER',
  description: 'Provides current wallet balances and token holdings',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<{ text: string; data: { tokens: TokenBalance[]; totalUSD: number; walletAddress: string } | null }> => {
    const walletAddress = getWalletOverride() || String(runtime.getSetting('WALLET_ADDRESS') ?? '');
    const heliusApiKey = String(runtime.getSetting('HELIUS_API_KEY') ?? '');

    if (!walletAddress || !heliusApiKey) {
      return {
        text: 'Wallet not configured. Set WALLET_ADDRESS and HELIUS_API_KEY.',
        data: null,
      };
    }

    let allTokens: TokenBalance[];

    try {
      const helius = new HeliusService(heliusApiKey);
      allTokens = await helius.getAssetsByOwner(walletAddress);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        text: `Failed to fetch wallet: ${message}`,
        data: null,
      };
    }

    // Sort by usdValue descending and take top 10
    const tokens = [...allTokens]
      .sort((a, b) => b.usdValue - a.usdValue)
      .slice(0, TOP_TOKENS_LIMIT);

    const totalUSD = allTokens.reduce((sum, t) => sum + t.usdValue, 0);

    const tokenLines = tokens
      .map((t) => `  ${t.symbol}: ${t.amount.toFixed(4)} ($${t.usdValue.toFixed(2)})`)
      .join('\n');

    const text = [
      `Wallet: ${walletAddress}`,
      `Total Value: $${totalUSD.toFixed(2)}`,
      'Top Holdings:',
      tokenLines,
    ].join('\n');

    return {
      text,
      data: { tokens, totalUSD, walletAddress },
    };
  },
};
