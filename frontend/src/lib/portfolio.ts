/**
 * Portfolio data client — fetches wallet token balances directly from
 * Helius DAS API (client-side). Uses VITE_ env vars for config.
 */

const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY as string;
const WALLET_ADDRESS = import.meta.env.VITE_WALLET_ADDRESS as string;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  decimals: number;
  rawAmount: string;
  uiAmount: number;
  priceUSD: number | null;
  valueUSD: number | null;
}

export interface WalletBalances {
  tokens: TokenBalance[];
  totalUSD: number;
}

// ─── Helius DAS response shapes (partial) ────────────────────────────────────

interface DASTokenInfo {
  symbol?: string;
  decimals?: number;
  token_program?: string;
  price_info?: {
    price_per_token?: number;
    total_price?: number;
    currency?: string;
  };
}

interface DASContent {
  metadata?: {
    name?: string;
    symbol?: string;
  };
  links?: {
    image?: string;
  };
}

interface DASAsset {
  id: string;
  token_info?: DASTokenInfo;
  content?: DASContent;
}

interface DASResponse {
  result?: {
    items?: DASAsset[];
    nativeBalance?: {
      lamports?: number;
      price_per_sol?: number;
      total_price?: number;
    };
  };
  error?: { code: number; message: string };
}

// ─── Helius DAS fetch ─────────────────────────────────────────────────────────

/**
 * Fetches all fungible token balances for the configured wallet address.
 * Uses the Helius DAS `getAssetsByOwner` RPC method with `showFungible: true`
 * and `showNativeBalance: true` to include SOL.
 *
 * @throws if env vars are missing or the API returns an error
 */
export async function fetchWalletBalances(): Promise<WalletBalances> {
  if (!HELIUS_API_KEY) {
    throw new Error('VITE_HELIUS_API_KEY is not set');
  }
  if (!WALLET_ADDRESS) {
    throw new Error('VITE_WALLET_ADDRESS is not set');
  }

  const endpoint = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

  const body = {
    jsonrpc: '2.0',
    id: 'reckonfi-portfolio',
    method: 'getAssetsByOwner',
    params: {
      ownerAddress: WALLET_ADDRESS,
      displayOptions: {
        showFungible: true,
        showNativeBalance: true,
        showZeroBalance: false,
      },
      page: 1,
      limit: 1000,
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Helius API request failed (${res.status}): ${text}`);
  }

  const data: DASResponse = await res.json();

  if (data.error) {
    throw new Error(`Helius RPC error ${data.error.code}: ${data.error.message}`);
  }

  const items = data.result?.items ?? [];
  const nativeBalance = data.result?.nativeBalance;

  const tokens: TokenBalance[] = [];
  let totalUSD = 0;

  // ── Native SOL balance ──────────────────────────────────────────────────────
  if (nativeBalance && nativeBalance.lamports != null) {
    const uiAmount = nativeBalance.lamports / 1e9;
    const priceUSD = nativeBalance.price_per_sol ?? null;
    const valueUSD = nativeBalance.total_price ?? (priceUSD != null ? uiAmount * priceUSD : null);

    tokens.push({
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      decimals: 9,
      rawAmount: String(nativeBalance.lamports),
      uiAmount,
      priceUSD,
      valueUSD,
    });

    if (valueUSD != null) totalUSD += valueUSD;
  }

  // ── Fungible SPL tokens ─────────────────────────────────────────────────────
  for (const asset of items) {
    const info = asset.token_info;
    const content = asset.content;

    const decimals = info?.decimals ?? 0;
    const symbol =
      info?.symbol ??
      content?.metadata?.symbol ??
      asset.id.slice(0, 6);
    const name = content?.metadata?.name ?? symbol;
    const logoURI = content?.links?.image ?? null;

    // Raw amount not directly in DAS items for fungible — derive from price info
    const priceUSD = info?.price_info?.price_per_token ?? null;
    const valueUSD = info?.price_info?.total_price ?? null;

    // ui amount: total_price / price_per_token if both present, else unknown
    let uiAmount = 0;
    if (valueUSD != null && priceUSD != null && priceUSD > 0) {
      uiAmount = valueUSD / priceUSD;
    }

    tokens.push({
      mint: asset.id,
      symbol,
      name,
      logoURI,
      decimals,
      rawAmount: '0', // DAS doesn't expose raw amount in this endpoint variant
      uiAmount,
      priceUSD,
      valueUSD,
    });

    if (valueUSD != null) totalUSD += valueUSD;
  }

  // Sort by USD value descending, unknowns last
  tokens.sort((a, b) => {
    if (a.valueUSD == null && b.valueUSD == null) return 0;
    if (a.valueUSD == null) return 1;
    if (b.valueUSD == null) return -1;
    return b.valueUSD - a.valueUSD;
  });

  return { tokens, totalUSD };
}
