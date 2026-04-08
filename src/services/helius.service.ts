import type { TokenBalance } from '../types/index';

const HELIUS_RPC_BASE = 'https://mainnet.helius-rpc.com';
const HELIUS_API_BASE = 'https://api.helius.xyz';
const DEFAULT_TX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Internal DAS types
// ---------------------------------------------------------------------------

interface DasPriceInfo {
  price_per_token: number;
}

interface DasTokenInfo {
  balance: number;
  decimals: number;
  symbol: string;
  price_info?: DasPriceInfo;
}

interface DasAsset {
  id: string;
  content?: { metadata?: { symbol?: string; name?: string } };
  token_info?: DasTokenInfo | null;
}

interface DasNativeBalance {
  lamports: number;
  price_per_sol: number;
  total_price: number;
}

interface DasGetAssetsByOwnerResult {
  result: {
    items: DasAsset[];
    nativeBalance?: DasNativeBalance;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Helius API client for DAS (Digital Asset Standard) queries and
 * enhanced transaction history.
 */
export class HeliusService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetches all token balances for a wallet using the Helius DAS
   * `getAssetsByOwner` RPC method.
   *
   * Items without `token_info` or with a zero balance are filtered out.
   *
   * @returns Array of TokenBalance objects with USD values.
   * @throws On non-2xx HTTP responses.
   */
  async getAssetsByOwner(walletAddress: string): Promise<TokenBalance[]> {
    const url = `${HELIUS_RPC_BASE}/?api-key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'reckonfi',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          displayOptions: {
            showFungible: true,
            showNativeBalance: true,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = (await response.json()) as DasGetAssetsByOwnerResult;
    const items = data.result.items;
    const balances: TokenBalance[] = [];

    // Add native SOL balance
    const native = data.result.nativeBalance;
    if (native && native.lamports > 0) {
      const solAmount = native.lamports / 1e9;
      balances.push({
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        amount: solAmount,
        usdValue: native.total_price,
      });
    }

    // Add SPL tokens
    for (const item of items) {
      if (!item.token_info || item.token_info.balance <= 0) continue;

      const info = item.token_info;
      const symbol =
        info.symbol ||
        item.content?.metadata?.symbol ||
        '';

      // Skip tokens with no symbol (unverified/spam)
      if (!symbol) continue;

      const amount = info.balance / Math.pow(10, info.decimals);
      const pricePerToken = info.price_info?.price_per_token ?? 0;

      balances.push({
        mint: item.id,
        symbol,
        amount,
        usdValue: amount * pricePerToken,
      });
    }

    return balances;
  }

  /**
   * Fetches enhanced transaction history for a wallet address.
   *
   * @param walletAddress - Solana wallet public key (base58).
   * @param limit - Maximum number of transactions to return (default 100).
   * @returns Array of raw transaction objects from Helius enhanced API.
   * @throws On non-2xx HTTP responses.
   */
  async getTransactionHistory(
    walletAddress: string,
    limit: number = DEFAULT_TX_LIMIT
  ): Promise<unknown[]> {
    const url = `${HELIUS_API_BASE}/v0/addresses/${walletAddress}/transactions?api-key=${this.apiKey}&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    return (await response.json()) as unknown[];
  }
}
