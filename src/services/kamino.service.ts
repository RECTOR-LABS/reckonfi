import type { Position, ProtocolService, TokenBalance } from '../types/index';

const HELIUS_RPC_BASE = 'https://mainnet.helius-rpc.com';

// ---------------------------------------------------------------------------
// Internal DAS types
// ---------------------------------------------------------------------------

interface DasAuthority {
  address: string;
  scopes: string[];
}

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
  token_info?: DasTokenInfo | null;
  authorities?: DasAuthority[];
}

interface DasGetAssetsByOwnerResult {
  result: {
    items: DasAsset[];
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * KaminoService detects and parses Kamino lending positions from a wallet
 * using the Helius DAS `getAssetsByOwner` RPC endpoint.
 *
 * Detection strategy: Kamino lending receipts are SPL tokens whose mint
 * authority resolves to the Kamino Lending program. In the DAS response
 * this manifests as an `authorities` entry whose `address` starts with
 * 'KLend'.
 *
 * Phase 1 scope:
 *   - Position detection and USD valuation are implemented.
 *   - healthFactor and liquidationPrice are null pending Phase 2 SDK
 *     integration (requires on-chain obligation account parsing via
 *     @hubbleprotocol/kamino-lending-sdk).
 */
export class KaminoService implements ProtocolService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Returns all Kamino lending positions held by `walletAddress`.
   *
   * @param walletAddress - Solana wallet public key (base58).
   * @returns Array of Position objects with protocol='kamino', type='lending'.
   * @throws On non-2xx HTTP responses from the Helius DAS API.
   */
  async getPositions(walletAddress: string): Promise<Position[]> {
    const assets = await this.fetchWalletAssets(walletAddress);
    return assets
      .filter(this.isKaminoPosition)
      .filter((asset): asset is DasAsset & { token_info: DasTokenInfo } => {
        return asset.token_info != null && asset.token_info.balance > 0;
      })
      .map((asset) => this.parsePosition(asset));
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Fetches all assets for a wallet via the Helius DAS `getAssetsByOwner`
   * RPC method.
   *
   * @throws {Error} On non-2xx HTTP responses.
   */
  private async fetchWalletAssets(walletAddress: string): Promise<DasAsset[]> {
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
            showNativeBalance: false,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = (await response.json()) as DasGetAssetsByOwnerResult;
    return data.result.items;
  }

  /**
   * Returns true if a DAS asset is a Kamino lending receipt token.
   *
   * Kamino lending cTokens (e.g. kUSDC, kSOL) have their mint authority
   * set to the Kamino Lending program. The Helius DAS `authorities` array
   * surfaces this: at least one authority address must start with 'KLend'.
   */
  private isKaminoPosition(asset: DasAsset): boolean {
    return (asset.authorities ?? []).some((auth) =>
      auth.address.startsWith('KLend')
    );
  }

  /**
   * Converts a DAS asset with confirmed token_info into a Position.
   *
   * Phase 1: healthFactor and liquidationPrice are null.
   * Phase 2 will add on-chain obligation parsing via the Kamino lending SDK
   * to compute these values.
   */
  private parsePosition(
    asset: DasAsset & { token_info: DasTokenInfo }
  ): Position {
    const info = asset.token_info;
    const amount = info.balance / Math.pow(10, info.decimals);
    const pricePerToken = info.price_info?.price_per_token ?? 0;
    const usdValue = amount * pricePerToken;

    const token: TokenBalance = {
      mint: asset.id,
      symbol: info.symbol,
      amount,
      usdValue,
    };

    return {
      protocol: 'kamino',
      type: 'lending',
      tokens: [token],
      value: usdValue,
      // Phase 1: requires on-chain obligation account parsing (Phase 2 — SDK integration)
      healthFactor: null,
      liquidationPrice: null,
      pnl: 0,
      apy: 0,
      metadata: { mint: asset.id },
    } satisfies Position;
  }
}
