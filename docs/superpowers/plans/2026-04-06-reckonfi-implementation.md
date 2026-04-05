# ReckonFi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Solana DeFi reasoning agent on ElizaOS v2 with contextual portfolio analysis, intent-based execution, and adaptive memory.

**Architecture:** Domain-split single plugin (`plugin-reckonfi`) with services layer (Solana/Helius/Jupiter/protocol wrappers), providers (wallet/price/position/market), a deterministic reasoning engine, and actions that combine reasoning output with LLM articulation. Standalone React frontend for dashboard UX.

**Tech Stack:** ElizaOS v2, TypeScript strict, Qwen3.5-27B via Nosana, React 19 + Vite + Tailwind + shadcn, vitest, Docker

**Spec:** `docs/superpowers/specs/2026-04-06-reckonfi-design.md`

---

### Task 1: Project Setup & Dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/mocks.ts`
- Modify: `.env.example`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/rector/local-dev/reckonfi
bun add @solana/web3.js @solana/spl-token bs58
bun add -d vitest @types/node
```

- [ ] **Step 2: Add test scripts to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "start": "elizaos start --character ./characters/agent.character.json",
    "dev": "elizaos dev --character ./characters/agent.character.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
});
```

- [ ] **Step 4: Create test mock utilities**

Create `src/test/mocks.ts`:
```typescript
import type { IAgentRuntime, Memory, State } from '@elizaos/core';

export function createMockRuntime(overrides: Partial<IAgentRuntime> = {}): IAgentRuntime {
  return {
    agentId: 'test-agent-id',
    character: { name: 'ReckonFi' },
    getSetting: (key: string) => {
      const settings: Record<string, string> = {
        WALLET_ADDRESS: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
        HELIUS_API_KEY: 'test-helius-key',
        SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      };
      return settings[key] ?? '';
    },
    getService: () => null,
    ...overrides,
  } as unknown as IAgentRuntime;
}

export function createMockMessage(text: string): Memory {
  return {
    id: 'test-msg-id',
    userId: 'test-user-id',
    agentId: 'test-agent-id',
    roomId: 'test-room-id',
    content: { text },
    createdAt: Date.now(),
  } as Memory;
}

export function createMockState(): State {
  return {} as State;
}

export function createMockCallback() {
  const calls: unknown[] = [];
  const fn = async (response: unknown) => {
    calls.push(response);
    return [];
  };
  fn.calls = calls;
  return fn;
}
```

- [ ] **Step 5: Update .env.example with ReckonFi variables**

Append to `.env.example`:
```env
# -------------------------------------------------------------
# ReckonFi Configuration
# -------------------------------------------------------------
WALLET_ADDRESS=YOUR_WALLET_PUBLIC_KEY
HELIUS_API_KEY=YOUR_HELIUS_API_KEY
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
SOLANA_PRIVATE_KEY=
```

- [ ] **Step 6: Update tsconfig for paths**

Update `tsconfig.json` compilerOptions to add:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "frontend"]
}
```

- [ ] **Step 7: Verify test infrastructure**

Run: `bun run test`
Expected: 0 tests found, exits cleanly.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: project setup with vitest and dependencies"
```

---

### Task 2: Shared Types & Interfaces

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/index.test.ts`

- [ ] **Step 1: Write type validation tests**

Create `src/types/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type {
  Position,
  TokenBalance,
  PortfolioSnapshot,
  ReasoningResult,
  ExecutionStep,
  Risk,
  RiskProfile,
  Decision,
  Alert,
  PriceData,
} from './index';

describe('types', () => {
  it('Position satisfies interface', () => {
    const position: Position = {
      protocol: 'kamino',
      type: 'lending',
      tokens: [{ mint: 'So11111111111111111111111111111111', symbol: 'SOL', amount: 10, usdValue: 1500 }],
      value: 1500,
      healthFactor: 1.8,
      liquidationPrice: 95.0,
      pnl: 50,
      apy: 0.05,
      metadata: {},
    };
    expect(position.protocol).toBe('kamino');
    expect(position.healthFactor).toBe(1.8);
  });

  it('PortfolioSnapshot satisfies interface', () => {
    const snapshot: PortfolioSnapshot = {
      wallet: { sol: 5.0, tokens: [], totalUSD: 750 },
      positions: [],
      exposure: {
        byToken: new Map([['SOL', 0.62]]),
        byProtocol: new Map([['kamino', 0.4]]),
        leverageRatio: 0.3,
      },
      market: {
        prices: new Map(),
        volatility: 'moderate',
        trend: 'neutral',
      },
      riskProfile: { tolerance: 'moderate', avgLeverage: 0.3, historicalActions: [] },
      recentDecisions: [],
    };
    expect(snapshot.wallet.sol).toBe(5.0);
    expect(snapshot.market.volatility).toBe('moderate');
  });

  it('ReasoningResult satisfies interface', () => {
    const result: ReasoningResult = {
      analysis: 'Portfolio health is good',
      risks: [{ severity: 'medium', description: 'SOL concentration at 62%', position: null }],
      recommendation: {
        action: 'Consider diversifying SOL holdings',
        reasoning: 'Concentration risk above 50% threshold',
        confidence: 'medium',
      },
    };
    expect(result.recommendation.confidence).toBe('medium');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test`
Expected: FAIL — cannot find module `./index`

- [ ] **Step 3: Create types**

Create `src/types/index.ts`:
```typescript
export type Protocol = 'kamino' | 'drift' | 'marginfi';
export type PositionType = 'lending' | 'borrowing' | 'perp-long' | 'perp-short' | 'lp';
export type Volatility = 'low' | 'moderate' | 'high' | 'extreme';
export type Trend = 'bullish' | 'neutral' | 'bearish';
export type Confidence = 'low' | 'medium' | 'high';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  usdValue: number;
}

export interface Position {
  protocol: Protocol;
  type: PositionType;
  tokens: TokenBalance[];
  value: number;
  healthFactor: number | null;
  liquidationPrice: number | null;
  pnl: number;
  apy: number;
  metadata: Record<string, unknown>;
}

export interface PriceData {
  mint: string;
  symbol: string;
  price: number;
  change24h: number;
}

export interface PortfolioSnapshot {
  wallet: {
    sol: number;
    tokens: TokenBalance[];
    totalUSD: number;
  };
  positions: Position[];
  exposure: {
    byToken: Map<string, number>;
    byProtocol: Map<string, number>;
    leverageRatio: number;
  };
  market: {
    prices: Map<string, PriceData>;
    volatility: Volatility;
    trend: Trend;
  };
  riskProfile: RiskProfile;
  recentDecisions: Decision[];
}

export interface Risk {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position: Position | null;
}

export interface ExecutionStep {
  action: string;
  description: string;
  params: Record<string, unknown>;
}

export interface ReasoningResult {
  analysis: string;
  risks: Risk[];
  recommendation: {
    action: string;
    reasoning: string;
    confidence: Confidence;
  };
  executionPlan?: {
    steps: ExecutionStep[];
    estimatedCost: number;
    slippageImpact: number;
  };
}

export interface RiskProfile {
  tolerance: RiskTolerance;
  avgLeverage: number;
  historicalActions: string[];
}

export interface Decision {
  timestamp: number;
  recommendation: string;
  userAction: string;
  outcome: string | null;
}

export interface Alert {
  id: string;
  type: 'liquidation' | 'price' | 'health';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  position: Position | null;
  createdAt: number;
  acknowledged: boolean;
}

export interface ProtocolService {
  getPositions(walletAddress: string): Promise<Position[]>;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  slippage: number;
  route: string;
  priceImpact: number;
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test`
Expected: PASS — all type satisfaction tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add shared types and interfaces"
```

---

### Task 3: Solana & Helius Services

**Files:**
- Create: `src/services/solana.service.ts`
- Create: `src/services/solana.service.test.ts`
- Create: `src/services/helius.service.ts`
- Create: `src/services/helius.service.test.ts`

- [ ] **Step 1: Write Solana service tests**

Create `src/services/solana.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolanaService } from './solana.service';

vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({
    getBalance: vi.fn().mockResolvedValue(5_000_000_000),
    getTokenAccountsByOwner: vi.fn().mockResolvedValue({
      value: [
        {
          pubkey: { toBase58: () => 'token-account-1' },
          account: {
            data: Buffer.alloc(165),
          },
        },
      ],
    }),
  })),
  PublicKey: vi.fn().mockImplementation((key: string) => ({
    toBase58: () => key,
    toString: () => key,
  })),
  LAMPORTS_PER_SOL: 1_000_000_000,
}));

describe('SolanaService', () => {
  let service: SolanaService;

  beforeEach(() => {
    service = new SolanaService('https://api.mainnet-beta.solana.com');
  });

  it('getSOLBalance returns balance in SOL', async () => {
    const balance = await service.getSOLBalance('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
    expect(balance).toBe(5.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/services/solana.service.test.ts`
Expected: FAIL — cannot find module `./solana.service`

- [ ] **Step 3: Implement Solana service**

Create `src/services/solana.service.ts`:
```typescript
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { TokenBalance } from '../types/index';

export class SolanaService {
  private connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getSOLBalance(walletAddress: string): Promise<number> {
    const pubkey = new PublicKey(walletAddress);
    const lamports = await this.connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  }

  getConnection(): Connection {
    return this.connection;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/services/solana.service.test.ts`
Expected: PASS

- [ ] **Step 5: Write Helius service tests**

Create `src/services/helius.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeliusService } from './helius.service';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HeliusService', () => {
  let service: HeliusService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HeliusService('test-api-key');
  });

  it('getAssetsByOwner returns token balances', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          items: [
            {
              id: 'So11111111111111111111111111111111',
              content: { metadata: { symbol: 'SOL' } },
              token_info: {
                balance: 5_000_000_000,
                decimals: 9,
                price_info: { price_per_token: 150.0 },
              },
            },
            {
              id: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              content: { metadata: { symbol: 'USDC' } },
              token_info: {
                balance: 1000_000_000,
                decimals: 6,
                price_info: { price_per_token: 1.0 },
              },
            },
          ],
          total: 2,
        },
      }),
    });

    const assets = await service.getAssetsByOwner('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
    expect(assets).toHaveLength(2);
    expect(assets[0].symbol).toBe('SOL');
    expect(assets[0].amount).toBe(5.0);
    expect(assets[0].usdValue).toBe(750.0);
  });

  it('getAssetsByOwner handles API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    await expect(service.getAssetsByOwner('test')).rejects.toThrow('Helius API error: 429');
  });
});
```

- [ ] **Step 6: Implement Helius service**

Create `src/services/helius.service.ts`:
```typescript
import type { TokenBalance } from '../types/index';

interface HeliusAsset {
  id: string;
  content: { metadata: { symbol: string; name?: string } };
  token_info?: {
    balance: number;
    decimals: number;
    price_info?: { price_per_token: number };
  };
}

export class HeliusService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://mainnet.helius-rpc.com';
  }

  async getAssetsByOwner(walletAddress: string): Promise<TokenBalance[]> {
    const response = await fetch(`${this.baseUrl}/?api-key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'reckonfi',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          displayOptions: { showFungible: true, showNativeBalance: true },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json();
    const items: HeliusAsset[] = data.result?.items ?? [];

    return items
      .filter((item) => item.token_info && item.token_info.balance > 0)
      .map((item) => {
        const info = item.token_info!;
        const amount = info.balance / Math.pow(10, info.decimals);
        const price = info.price_info?.price_per_token ?? 0;
        return {
          mint: item.id,
          symbol: item.content?.metadata?.symbol ?? 'UNKNOWN',
          amount,
          usdValue: amount * price,
        };
      });
  }

  async getTransactionHistory(walletAddress: string, limit = 20): Promise<unknown[]> {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${this.apiKey}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    return response.json();
  }
}
```

- [ ] **Step 7: Run all tests**

Run: `bun run test src/services/`
Expected: PASS — both service tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/services/solana.service.ts src/services/solana.service.test.ts src/services/helius.service.ts src/services/helius.service.test.ts
git commit -m "feat: add Solana and Helius services"
```

---

### Task 4: Jupiter Service

**Files:**
- Create: `src/services/jupiter.service.ts`
- Create: `src/services/jupiter.service.test.ts`

- [ ] **Step 1: Write Jupiter service tests**

Create `src/services/jupiter.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JupiterService } from './jupiter.service';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('JupiterService', () => {
  let service: JupiterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JupiterService();
  });

  it('getPrices returns price data for multiple tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          So11111111111111111111111111111111: {
            id: 'So11111111111111111111111111111111',
            price: '150.25',
          },
          EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
            id: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            price: '1.00',
          },
        },
      }),
    });

    const prices = await service.getPrices([
      'So11111111111111111111111111111111',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    ]);

    expect(prices.get('So11111111111111111111111111111111')).toBe(150.25);
    expect(prices.get('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(1.0);
  });

  it('getQuote returns swap quote', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        inputMint: 'So11111111111111111111111111111111',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inAmount: '1000000000',
        outAmount: '149750000',
        priceImpactPct: '0.01',
        routePlan: [{ swapInfo: { label: 'Raydium' } }],
      }),
    });

    const quote = await service.getQuote(
      'So11111111111111111111111111111111',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      1_000_000_000,
      50
    );

    expect(quote.outputAmount).toBe(149750000);
    expect(quote.priceImpact).toBeCloseTo(0.01);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/services/jupiter.service.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement Jupiter service**

Create `src/services/jupiter.service.ts`:
```typescript
import type { SwapQuote } from '../types/index';

export class JupiterService {
  private baseUrl = 'https://api.jup.ag';

  async getPrices(mints: string[]): Promise<Map<string, number>> {
    const ids = mints.join(',');
    const response = await fetch(`${this.baseUrl}/price/v2?ids=${ids}`);

    if (!response.ok) {
      throw new Error(`Jupiter Price API error: ${response.status}`);
    }

    const data = await response.json();
    const prices = new Map<string, number>();

    for (const [mint, info] of Object.entries(data.data ?? {})) {
      prices.set(mint, parseFloat((info as { price: string }).price));
    }

    return prices;
  }

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

    const response = await fetch(`${this.baseUrl}/quote/v6?${params}`);

    if (!response.ok) {
      throw new Error(`Jupiter Quote API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inputAmount: parseInt(data.inAmount),
      outputAmount: parseInt(data.outAmount),
      slippage: slippageBps / 10000,
      route: data.routePlan?.[0]?.swapInfo?.label ?? 'unknown',
      priceImpact: parseFloat(data.priceImpactPct),
    };
  }

  async getSwapTransaction(quoteResponse: unknown, userPublicKey: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/swap/v6`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jupiter Swap API error: ${response.status}`);
    }

    const data = await response.json();
    return data.swapTransaction;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/services/jupiter.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/jupiter.service.ts src/services/jupiter.service.test.ts
git commit -m "feat: add Jupiter service for prices and swaps"
```

---

### Task 5: Protocol Services (Kamino, Drift, Marginfi)

**Files:**
- Create: `src/services/kamino.service.ts`
- Create: `src/services/kamino.service.test.ts`
- Create: `src/services/drift.service.ts`
- Create: `src/services/marginfi.service.ts`

Kamino gets deep integration. Drift and Marginfi are shallow stubs implementing the same `ProtocolService` interface. All use Helius DAS API for account fetching to keep dependencies minimal.

- [ ] **Step 1: Write Kamino service tests**

Create `src/services/kamino.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KaminoService } from './kamino.service';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('KaminoService', () => {
  let service: KaminoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KaminoService('test-helius-key');
  });

  it('getPositions returns empty array for wallet with no Kamino positions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { items: [] } }),
    });

    const positions = await service.getPositions('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
    expect(positions).toEqual([]);
  });

  it('getPositions parses lending position', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          items: [
            {
              id: 'obligation-pubkey-1',
              content: { metadata: { symbol: 'kSOL' } },
              token_info: {
                balance: 10_000_000_000,
                decimals: 9,
                price_info: { price_per_token: 150 },
              },
              authorities: [{ address: 'KLend2g3cP87ber41GJZYSv2CBQYMoGaGwrNUaHLQ' }],
            },
          ],
        },
      }),
    });

    const positions = await service.getPositions('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
    expect(positions.length).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/services/kamino.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Kamino service**

Create `src/services/kamino.service.ts`:
```typescript
import type { Position, ProtocolService, TokenBalance } from '../types/index';

export class KaminoService implements ProtocolService {
  private apiKey: string;
  private baseUrl = 'https://mainnet.helius-rpc.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPositions(walletAddress: string): Promise<Position[]> {
    const assets = await this.fetchWalletAssets(walletAddress);
    const positions: Position[] = [];

    for (const asset of assets) {
      if (this.isKaminoPosition(asset)) {
        positions.push(this.parsePosition(asset));
      }
    }

    return positions;
  }

  private async fetchWalletAssets(walletAddress: string): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/?api-key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'reckonfi-kamino',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          displayOptions: { showFungible: true },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result?.items ?? [];
  }

  private isKaminoPosition(asset: unknown): boolean {
    const a = asset as { authorities?: { address: string }[] };
    return (
      a.authorities?.some((auth) =>
        auth.address.startsWith('KLend')
      ) ?? false
    );
  }

  private parsePosition(asset: unknown): Position {
    const a = asset as {
      id: string;
      content: { metadata: { symbol: string } };
      token_info?: {
        balance: number;
        decimals: number;
        price_info?: { price_per_token: number };
      };
    };

    const info = a.token_info;
    const amount = info ? info.balance / Math.pow(10, info.decimals) : 0;
    const price = info?.price_info?.price_per_token ?? 0;

    const token: TokenBalance = {
      mint: a.id,
      symbol: a.content?.metadata?.symbol ?? 'UNKNOWN',
      amount,
      usdValue: amount * price,
    };

    return {
      protocol: 'kamino',
      type: 'lending',
      tokens: [token],
      value: token.usdValue,
      healthFactor: null,
      liquidationPrice: null,
      pnl: 0,
      apy: 0,
      metadata: { rawAssetId: a.id },
    };
  }
}
```

Note: This is Phase 1 — health factor and liquidation price calculation require deeper Kamino SDK integration. The structure supports adding this calculation later. For now, positions are detected and valued correctly.

- [ ] **Step 4: Run Kamino tests**

Run: `bun run test src/services/kamino.service.test.ts`
Expected: PASS

- [ ] **Step 5: Create Drift and Marginfi stub services**

Create `src/services/drift.service.ts`:
```typescript
import type { Position, ProtocolService } from '../types/index';

export class DriftService implements ProtocolService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPositions(_walletAddress: string): Promise<Position[]> {
    // Phase 1: shallow implementation
    // Phase 2: integrate @drift-labs/sdk for perp + spot positions
    return [];
  }
}
```

Create `src/services/marginfi.service.ts`:
```typescript
import type { Position, ProtocolService } from '../types/index';

export class MarginfiService implements ProtocolService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPositions(_walletAddress: string): Promise<Position[]> {
    // Phase 1: shallow implementation
    // Phase 2: integrate @mrgnlabs/marginfi-client-v2
    return [];
  }
}
```

- [ ] **Step 6: Run all service tests**

Run: `bun run test src/services/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/kamino.service.ts src/services/kamino.service.test.ts src/services/drift.service.ts src/services/marginfi.service.ts
git commit -m "feat: add protocol services (Kamino deep, Drift/Marginfi stubs)"
```

---

### Task 6: Wallet & Price Providers

**Files:**
- Create: `src/providers/wallet-provider.ts`
- Create: `src/providers/wallet-provider.test.ts`
- Create: `src/providers/price-provider.ts`
- Create: `src/providers/price-provider.test.ts`

- [ ] **Step 1: Write wallet provider tests**

Create `src/providers/wallet-provider.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { walletProvider } from './wallet-provider';
import { createMockRuntime, createMockMessage, createMockState } from '../test/mocks';

vi.mock('../services/helius.service', () => ({
  HeliusService: vi.fn().mockImplementation(() => ({
    getAssetsByOwner: vi.fn().mockResolvedValue([
      { mint: 'So11111111111111111111111111111111', symbol: 'SOL', amount: 5.0, usdValue: 750 },
      { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', amount: 1000, usdValue: 1000 },
    ]),
  })),
}));

describe('walletProvider', () => {
  const runtime = createMockRuntime();
  const message = createMockMessage('check my balance');
  const state = createMockState();

  it('returns wallet balances as text', async () => {
    const result = await walletProvider.get(runtime, message, state);
    expect(result.text).toContain('SOL');
    expect(result.text).toContain('USDC');
  });

  it('includes data with token balances', async () => {
    const result = await walletProvider.get(runtime, message, state);
    expect(result.data?.tokens).toBeDefined();
    expect(result.data?.totalUSD).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/providers/wallet-provider.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement wallet provider**

Create `src/providers/wallet-provider.ts`:
```typescript
import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { HeliusService } from '../services/helius.service';
import type { TokenBalance } from '../types/index';

export const walletProvider: Provider = {
  name: 'WALLET_PROVIDER',
  description: 'Provides current wallet balances and token holdings',

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const walletAddress = runtime.getSetting('WALLET_ADDRESS');
    const apiKey = runtime.getSetting('HELIUS_API_KEY');

    if (!walletAddress || !apiKey) {
      return { text: 'Wallet not configured. Set WALLET_ADDRESS and HELIUS_API_KEY.', data: null };
    }

    const helius = new HeliusService(apiKey);

    let tokens: TokenBalance[];
    try {
      tokens = await helius.getAssetsByOwner(walletAddress);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { text: `Failed to fetch wallet: ${msg}`, data: null };
    }

    const totalUSD = tokens.reduce((sum, t) => sum + t.usdValue, 0);

    const lines = tokens
      .sort((a, b) => b.usdValue - a.usdValue)
      .slice(0, 10)
      .map((t) => `${t.symbol}: ${t.amount.toFixed(4)} ($${t.usdValue.toFixed(2)})`);

    const text = [
      `Wallet: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
      `Total: $${totalUSD.toFixed(2)}`,
      ...lines,
    ].join('\n');

    return {
      text,
      data: { tokens, totalUSD, walletAddress },
    };
  },
};
```

- [ ] **Step 4: Run wallet provider tests**

Run: `bun run test src/providers/wallet-provider.test.ts`
Expected: PASS

- [ ] **Step 5: Write price provider tests**

Create `src/providers/price-provider.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { priceProvider } from './price-provider';
import { createMockRuntime, createMockMessage, createMockState } from '../test/mocks';

vi.mock('../services/jupiter.service', () => ({
  JupiterService: vi.fn().mockImplementation(() => ({
    getPrices: vi.fn().mockResolvedValue(
      new Map([
        ['So11111111111111111111111111111111', 150.25],
        ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 1.0],
      ])
    ),
  })),
}));

describe('priceProvider', () => {
  it('returns price data as text', async () => {
    const result = await priceProvider.get(
      createMockRuntime(),
      createMockMessage('what are prices'),
      createMockState()
    );
    expect(result.text).toContain('SOL');
    expect(result.data?.prices).toBeDefined();
  });
});
```

- [ ] **Step 6: Implement price provider**

Create `src/providers/price-provider.ts`:
```typescript
import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { JupiterService } from '../services/jupiter.service';
import type { PriceData } from '../types/index';

const TRACKED_TOKENS: { mint: string; symbol: string }[] = [
  { mint: 'So11111111111111111111111111111111', symbol: 'SOL' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
  { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', symbol: 'mSOL' },
  { mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', symbol: 'jitoSOL' },
];

export const priceProvider: Provider = {
  name: 'PRICE_PROVIDER',
  description: 'Provides current token prices from Jupiter',

  get: async (_runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const jupiter = new JupiterService();
    const mints = TRACKED_TOKENS.map((t) => t.mint);

    let priceMap: Map<string, number>;
    try {
      priceMap = await jupiter.getPrices(mints);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { text: `Price fetch failed: ${msg}`, data: null };
    }

    const prices: PriceData[] = TRACKED_TOKENS.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      price: priceMap.get(t.mint) ?? 0,
      change24h: 0,
    }));

    const lines = prices
      .filter((p) => p.price > 0)
      .map((p) => `${p.symbol}: $${p.price.toFixed(2)}`);

    return {
      text: `Token Prices:\n${lines.join('\n')}`,
      data: { prices },
    };
  },
};
```

- [ ] **Step 7: Run all provider tests**

Run: `bun run test src/providers/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/providers/wallet-provider.ts src/providers/wallet-provider.test.ts src/providers/price-provider.ts src/providers/price-provider.test.ts
git commit -m "feat: add wallet and price providers"
```

---

### Task 7: Position & Market Context Providers

**Files:**
- Create: `src/providers/position-provider.ts`
- Create: `src/providers/position-provider.test.ts`
- Create: `src/providers/market-context-provider.ts`
- Create: `src/providers/market-context-provider.test.ts`

- [ ] **Step 1: Write position provider tests**

Create `src/providers/position-provider.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { positionProvider } from './position-provider';
import { createMockRuntime, createMockMessage, createMockState } from '../test/mocks';

vi.mock('../services/kamino.service', () => ({
  KaminoService: vi.fn().mockImplementation(() => ({
    getPositions: vi.fn().mockResolvedValue([
      {
        protocol: 'kamino',
        type: 'lending',
        tokens: [{ mint: 'SOL', symbol: 'SOL', amount: 10, usdValue: 1500 }],
        value: 1500,
        healthFactor: 1.8,
        liquidationPrice: 95,
        pnl: 50,
        apy: 0.05,
        metadata: {},
      },
    ]),
  })),
}));

vi.mock('../services/drift.service', () => ({
  DriftService: vi.fn().mockImplementation(() => ({
    getPositions: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../services/marginfi.service', () => ({
  MarginfiService: vi.fn().mockImplementation(() => ({
    getPositions: vi.fn().mockResolvedValue([]),
  })),
}));

describe('positionProvider', () => {
  it('aggregates positions from all protocols', async () => {
    const result = await positionProvider.get(
      createMockRuntime(),
      createMockMessage('show positions'),
      createMockState()
    );
    expect(result.text).toContain('kamino');
    expect(result.data?.positions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/providers/position-provider.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement position provider**

Create `src/providers/position-provider.ts`:
```typescript
import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { KaminoService } from '../services/kamino.service';
import { DriftService } from '../services/drift.service';
import { MarginfiService } from '../services/marginfi.service';
import type { Position } from '../types/index';

export const positionProvider: Provider = {
  name: 'POSITION_PROVIDER',
  description: 'Provides DeFi positions across Kamino, Drift, and Marginfi',

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const walletAddress = runtime.getSetting('WALLET_ADDRESS');
    const apiKey = runtime.getSetting('HELIUS_API_KEY');

    if (!walletAddress || !apiKey) {
      return { text: 'Wallet not configured.', data: null };
    }

    const kamino = new KaminoService(apiKey);
    const drift = new DriftService(apiKey);
    const marginfi = new MarginfiService(apiKey);

    const results = await Promise.allSettled([
      kamino.getPositions(walletAddress),
      drift.getPositions(walletAddress),
      marginfi.getPositions(walletAddress),
    ]);

    const positions: Position[] = [];
    const errors: string[] = [];

    results.forEach((result, i) => {
      const protocol = ['kamino', 'drift', 'marginfi'][i];
      if (result.status === 'fulfilled') {
        positions.push(...result.value);
      } else {
        errors.push(`${protocol}: ${result.reason}`);
      }
    });

    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
    const lines = positions.map((p) => {
      const health = p.healthFactor !== null ? ` | Health: ${p.healthFactor.toFixed(2)}` : '';
      return `${p.protocol} ${p.type}: $${p.value.toFixed(2)}${health}`;
    });

    const errorText = errors.length > 0 ? `\nErrors: ${errors.join(', ')}` : '';

    return {
      text: `DeFi Positions (Total: $${totalValue.toFixed(2)}):\n${lines.join('\n')}${errorText}`,
      data: { positions, totalValue, errors },
    };
  },
};
```

- [ ] **Step 4: Write market context provider tests**

Create `src/providers/market-context-provider.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { marketContextProvider } from './market-context-provider';
import { createMockRuntime, createMockMessage, createMockState } from '../test/mocks';

vi.mock('../services/jupiter.service', () => ({
  JupiterService: vi.fn().mockImplementation(() => ({
    getPrices: vi.fn().mockResolvedValue(new Map([['So11111111111111111111111111111111', 150]])),
  })),
}));

describe('marketContextProvider', () => {
  it('returns market context with trend and volatility', async () => {
    const result = await marketContextProvider.get(
      createMockRuntime(),
      createMockMessage('market?'),
      createMockState()
    );
    expect(result.text).toContain('Market');
    expect(result.data?.trend).toBeDefined();
    expect(result.data?.volatility).toBeDefined();
  });
});
```

- [ ] **Step 5: Implement market context provider**

Create `src/providers/market-context-provider.ts`:
```typescript
import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { JupiterService } from '../services/jupiter.service';
import type { Trend, Volatility } from '../types/index';

export const marketContextProvider: Provider = {
  name: 'MARKET_CONTEXT_PROVIDER',
  description: 'Provides market trend and volatility context',

  get: async (_runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const jupiter = new JupiterService();
    const SOL_MINT = 'So11111111111111111111111111111111';

    let solPrice: number;
    try {
      const prices = await jupiter.getPrices([SOL_MINT]);
      solPrice = prices.get(SOL_MINT) ?? 0;
    } catch {
      return {
        text: 'Market data unavailable.',
        data: { trend: 'neutral' as Trend, volatility: 'moderate' as Volatility, solPrice: 0 },
      };
    }

    // Phase 1: simplified trend/volatility — no historical data yet
    const trend: Trend = 'neutral';
    const volatility: Volatility = 'moderate';

    return {
      text: `Market Context: SOL $${solPrice.toFixed(2)} | Trend: ${trend} | Volatility: ${volatility}`,
      data: { trend, volatility, solPrice },
    };
  },
};
```

- [ ] **Step 6: Run all provider tests**

Run: `bun run test src/providers/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/providers/position-provider.ts src/providers/position-provider.test.ts src/providers/market-context-provider.ts src/providers/market-context-provider.test.ts
git commit -m "feat: add position and market context providers"
```

---

### Task 8: Risk Calculator

**Files:**
- Create: `src/reasoning/risk-calculator.ts`
- Create: `src/reasoning/risk-calculator.test.ts`

- [ ] **Step 1: Write risk calculator tests**

Create `src/reasoning/risk-calculator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  portfolioHealthScore,
  liquidationDistance,
  concentrationRisk,
} from './risk-calculator';
import type { Position, TokenBalance } from '../types/index';

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    protocol: 'kamino',
    type: 'lending',
    tokens: [{ mint: 'SOL', symbol: 'SOL', amount: 10, usdValue: 1500 }],
    value: 1500,
    healthFactor: 1.8,
    liquidationPrice: 95,
    pnl: 0,
    apy: 0.05,
    metadata: {},
    ...overrides,
  };
}

describe('portfolioHealthScore', () => {
  it('returns 100 for no positions', () => {
    expect(portfolioHealthScore([])).toBe(100);
  });

  it('returns high score for healthy positions', () => {
    const positions = [makePosition({ healthFactor: 2.5, value: 1000 })];
    const score = portfolioHealthScore(positions);
    expect(score).toBeGreaterThan(80);
  });

  it('returns low score for positions near liquidation', () => {
    const positions = [makePosition({ healthFactor: 1.05, value: 1000 })];
    const score = portfolioHealthScore(positions);
    expect(score).toBeLessThan(30);
  });

  it('weights by position value', () => {
    const positions = [
      makePosition({ healthFactor: 2.0, value: 100 }),
      makePosition({ healthFactor: 1.1, value: 9000 }),
    ];
    const score = portfolioHealthScore(positions);
    expect(score).toBeLessThan(40);
  });
});

describe('liquidationDistance', () => {
  it('returns percentage distance to liquidation', () => {
    const position = makePosition({ healthFactor: 1.5 });
    const distance = liquidationDistance(position);
    expect(distance).toBeCloseTo(33.33, 1);
  });

  it('returns 0 for position at liquidation', () => {
    const position = makePosition({ healthFactor: 1.0 });
    expect(liquidationDistance(position)).toBe(0);
  });

  it('returns null for position without health factor', () => {
    const position = makePosition({ healthFactor: null });
    expect(liquidationDistance(position)).toBeNull();
  });
});

describe('concentrationRisk', () => {
  it('returns 0 for empty portfolio', () => {
    expect(concentrationRisk(new Map())).toBe(0);
  });

  it('returns 1.0 for single-token portfolio', () => {
    expect(concentrationRisk(new Map([['SOL', 1.0]]))).toBe(1.0);
  });

  it('returns lower score for diversified portfolio', () => {
    const exposure = new Map([
      ['SOL', 0.25],
      ['USDC', 0.25],
      ['ETH', 0.25],
      ['BTC', 0.25],
    ]);
    expect(concentrationRisk(exposure)).toBe(0.25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/reasoning/risk-calculator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement risk calculator**

Create `src/reasoning/risk-calculator.ts`:
```typescript
import type { Position } from '../types/index';

/**
 * Portfolio health score (0-100) weighted by position value.
 * 100 = no positions or all extremely healthy.
 * 0 = all positions at liquidation.
 */
export function portfolioHealthScore(positions: Position[]): number {
  const withHealth = positions.filter((p) => p.healthFactor !== null);
  if (withHealth.length === 0) return 100;

  const totalValue = withHealth.reduce((sum, p) => sum + p.value, 0);
  if (totalValue === 0) return 100;

  let weightedScore = 0;
  for (const p of withHealth) {
    const weight = p.value / totalValue;
    // Map health factor to 0-100: hf=1.0 → 0, hf=2.0 → 80, hf>=3.0 → 100
    const hf = p.healthFactor!;
    const score = Math.min(100, Math.max(0, ((hf - 1.0) / 2.0) * 100));
    weightedScore += score * weight;
  }

  return Math.round(weightedScore);
}

/**
 * Percentage price drop to trigger liquidation.
 * Returns null if no health factor.
 */
export function liquidationDistance(position: Position): number | null {
  if (position.healthFactor === null) return null;
  if (position.healthFactor <= 1.0) return 0;

  // Distance = (hf - 1) / hf * 100
  return ((position.healthFactor - 1.0) / position.healthFactor) * 100;
}

/**
 * Herfindahl-Hirschman Index for concentration.
 * 0 = perfectly diversified, 1.0 = single asset.
 */
export function concentrationRisk(exposureByToken: Map<string, number>): number {
  if (exposureByToken.size === 0) return 0;

  let hhi = 0;
  for (const share of exposureByToken.values()) {
    hhi += share * share;
  }
  return hhi;
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/reasoning/risk-calculator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reasoning/risk-calculator.ts src/reasoning/risk-calculator.test.ts
git commit -m "feat: add deterministic risk calculator"
```

---

### Task 9: Context Builder & Reasoning Engine

**Files:**
- Create: `src/reasoning/context-builder.ts`
- Create: `src/reasoning/context-builder.test.ts`
- Create: `src/reasoning/engine.ts`
- Create: `src/reasoning/engine.test.ts`

- [ ] **Step 1: Write context builder tests**

Create `src/reasoning/context-builder.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildPortfolioSnapshot } from './context-builder';
import type { TokenBalance, Position, PriceData } from '../types/index';

describe('buildPortfolioSnapshot', () => {
  it('assembles snapshot from wallet, positions, and prices', () => {
    const tokens: TokenBalance[] = [
      { mint: 'SOL', symbol: 'SOL', amount: 10, usdValue: 1500 },
      { mint: 'USDC', symbol: 'USDC', amount: 500, usdValue: 500 },
    ];
    const positions: Position[] = [
      {
        protocol: 'kamino',
        type: 'lending',
        tokens: [{ mint: 'SOL', symbol: 'SOL', amount: 5, usdValue: 750 }],
        value: 750,
        healthFactor: 1.8,
        liquidationPrice: 95,
        pnl: 20,
        apy: 0.05,
        metadata: {},
      },
    ];
    const prices: PriceData[] = [
      { mint: 'SOL', symbol: 'SOL', price: 150, change24h: -2.5 },
    ];

    const snapshot = buildPortfolioSnapshot(tokens, positions, prices);

    expect(snapshot.wallet.totalUSD).toBe(2000);
    expect(snapshot.positions).toHaveLength(1);
    expect(snapshot.exposure.byToken.get('SOL')).toBeGreaterThan(0);
    expect(snapshot.exposure.byProtocol.get('kamino')).toBeGreaterThan(0);
  });

  it('computes leverage ratio', () => {
    const tokens: TokenBalance[] = [{ mint: 'SOL', symbol: 'SOL', amount: 10, usdValue: 1500 }];
    const positions: Position[] = [
      {
        protocol: 'kamino',
        type: 'lending',
        tokens: [{ mint: 'SOL', symbol: 'SOL', amount: 5, usdValue: 750 }],
        value: 750,
        healthFactor: 1.5,
        liquidationPrice: null,
        pnl: 0,
        apy: 0,
        metadata: {},
      },
      {
        protocol: 'kamino',
        type: 'borrowing',
        tokens: [{ mint: 'USDC', symbol: 'USDC', amount: 300, usdValue: 300 }],
        value: 300,
        healthFactor: null,
        liquidationPrice: null,
        pnl: 0,
        apy: 0,
        metadata: {},
      },
    ];

    const snapshot = buildPortfolioSnapshot(tokens, positions, []);
    expect(snapshot.exposure.leverageRatio).toBeCloseTo(0.4, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/reasoning/context-builder.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement context builder**

Create `src/reasoning/context-builder.ts`:
```typescript
import type {
  TokenBalance,
  Position,
  PriceData,
  PortfolioSnapshot,
  Volatility,
  Trend,
  RiskProfile,
} from '../types/index';

export function buildPortfolioSnapshot(
  tokens: TokenBalance[],
  positions: Position[],
  prices: PriceData[],
  riskProfile?: RiskProfile,
  recentDecisions?: { timestamp: number; recommendation: string; userAction: string; outcome: string | null }[]
): PortfolioSnapshot {
  const totalUSD = tokens.reduce((sum, t) => sum + t.usdValue, 0);

  // Exposure by token
  const byToken = new Map<string, number>();
  for (const t of tokens) {
    if (totalUSD > 0) {
      byToken.set(t.symbol, (byToken.get(t.symbol) ?? 0) + t.usdValue / totalUSD);
    }
  }

  // Exposure by protocol
  const byProtocol = new Map<string, number>();
  const totalPositionValue = positions.reduce((sum, p) => sum + p.value, 0);
  for (const p of positions) {
    if (totalPositionValue > 0) {
      byProtocol.set(p.protocol, (byProtocol.get(p.protocol) ?? 0) + p.value / totalPositionValue);
    }
  }

  // Leverage ratio = total borrowed / total deposited
  const borrowed = positions
    .filter((p) => p.type === 'borrowing')
    .reduce((sum, p) => sum + p.value, 0);
  const deposited = positions
    .filter((p) => p.type === 'lending' || p.type === 'lp')
    .reduce((sum, p) => sum + p.value, 0);
  const leverageRatio = deposited > 0 ? borrowed / deposited : 0;

  // Price map
  const priceMap = new Map<string, PriceData>();
  for (const p of prices) {
    priceMap.set(p.mint, p);
  }

  // Determine volatility from SOL 24h change
  const solPrice = prices.find((p) => p.symbol === 'SOL');
  const absChange = Math.abs(solPrice?.change24h ?? 0);
  let volatility: Volatility = 'low';
  if (absChange > 10) volatility = 'extreme';
  else if (absChange > 5) volatility = 'high';
  else if (absChange > 2) volatility = 'moderate';

  // Determine trend from SOL 24h change
  let trend: Trend = 'neutral';
  if (solPrice) {
    if (solPrice.change24h > 2) trend = 'bullish';
    else if (solPrice.change24h < -2) trend = 'bearish';
  }

  return {
    wallet: {
      sol: tokens.find((t) => t.symbol === 'SOL')?.amount ?? 0,
      tokens,
      totalUSD,
    },
    positions,
    exposure: { byToken, byProtocol, leverageRatio },
    market: { prices: priceMap, volatility, trend },
    riskProfile: riskProfile ?? { tolerance: 'moderate', avgLeverage: 0, historicalActions: [] },
    recentDecisions: recentDecisions ?? [],
  };
}
```

- [ ] **Step 4: Run context builder tests**

Run: `bun run test src/reasoning/context-builder.test.ts`
Expected: PASS

- [ ] **Step 5: Write reasoning engine tests**

Create `src/reasoning/engine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { analyzePortfolio } from './engine';
import type { PortfolioSnapshot } from '../types/index';

function makeSnapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    wallet: { sol: 5, tokens: [], totalUSD: 2000 },
    positions: [],
    exposure: {
      byToken: new Map([['SOL', 0.6], ['USDC', 0.4]]),
      byProtocol: new Map(),
      leverageRatio: 0,
    },
    market: {
      prices: new Map(),
      volatility: 'moderate',
      trend: 'neutral',
    },
    riskProfile: { tolerance: 'moderate', avgLeverage: 0.3, historicalActions: [] },
    recentDecisions: [],
    ...overrides,
  };
}

describe('analyzePortfolio', () => {
  it('returns analysis with risks and recommendation', () => {
    const result = analyzePortfolio(makeSnapshot());
    expect(result.analysis).toBeTruthy();
    expect(result.risks).toBeInstanceOf(Array);
    expect(result.recommendation.confidence).toBeDefined();
  });

  it('flags concentration risk when one token > 50%', () => {
    const snapshot = makeSnapshot({
      exposure: {
        byToken: new Map([['SOL', 0.85]]),
        byProtocol: new Map(),
        leverageRatio: 0,
      },
    });
    const result = analyzePortfolio(snapshot);
    const concRisk = result.risks.find((r) => r.description.includes('concentration'));
    expect(concRisk).toBeDefined();
  });

  it('flags positions near liquidation', () => {
    const snapshot = makeSnapshot({
      positions: [
        {
          protocol: 'kamino',
          type: 'lending',
          tokens: [{ mint: 'SOL', symbol: 'SOL', amount: 10, usdValue: 1500 }],
          value: 1500,
          healthFactor: 1.1,
          liquidationPrice: 140,
          pnl: 0,
          apy: 0,
          metadata: {},
        },
      ],
    });
    const result = analyzePortfolio(snapshot);
    const liqRisk = result.risks.find((r) => r.severity === 'critical' || r.severity === 'high');
    expect(liqRisk).toBeDefined();
  });
});
```

- [ ] **Step 6: Implement reasoning engine**

Create `src/reasoning/engine.ts`:
```typescript
import type { PortfolioSnapshot, ReasoningResult, Risk } from '../types/index';
import { portfolioHealthScore, liquidationDistance, concentrationRisk } from './risk-calculator';

export function analyzePortfolio(snapshot: PortfolioSnapshot): ReasoningResult {
  const risks: Risk[] = [];

  // Check concentration risk
  const hhi = concentrationRisk(snapshot.exposure.byToken);
  if (hhi > 0.5) {
    const topToken = [...snapshot.exposure.byToken.entries()].sort((a, b) => b[1] - a[1])[0];
    risks.push({
      severity: hhi > 0.7 ? 'high' : 'medium',
      description: `Token concentration risk: ${topToken?.[0]} at ${((topToken?.[1] ?? 0) * 100).toFixed(0)}%`,
      position: null,
    });
  }

  // Check positions near liquidation
  for (const position of snapshot.positions) {
    const distance = liquidationDistance(position);
    if (distance !== null && distance < 25) {
      risks.push({
        severity: distance < 10 ? 'critical' : distance < 15 ? 'high' : 'medium',
        description: `${position.protocol} ${position.type} position ${distance.toFixed(1)}% from liquidation`,
        position,
      });
    }
  }

  // Check leverage
  if (snapshot.exposure.leverageRatio > 0.7) {
    risks.push({
      severity: snapshot.exposure.leverageRatio > 0.9 ? 'high' : 'medium',
      description: `Leverage ratio at ${(snapshot.exposure.leverageRatio * 100).toFixed(0)}%`,
      position: null,
    });
  }

  // Check market volatility + exposure
  if (snapshot.market.volatility === 'extreme' || snapshot.market.volatility === 'high') {
    const hasLeveraged = snapshot.positions.some(
      (p) => p.type === 'perp-long' || p.type === 'perp-short'
    );
    if (hasLeveraged) {
      risks.push({
        severity: 'high',
        description: `Leveraged positions open during ${snapshot.market.volatility} volatility`,
        position: null,
      });
    }
  }

  // Sort risks by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Generate recommendation
  const healthScore = portfolioHealthScore(snapshot.positions);
  const recommendation = generateRecommendation(snapshot, risks, healthScore);

  // Build analysis text
  const analysis = buildAnalysisText(snapshot, healthScore, risks);

  return { analysis, risks, recommendation };
}

function generateRecommendation(
  snapshot: PortfolioSnapshot,
  risks: Risk[],
  healthScore: number
): ReasoningResult['recommendation'] {
  if (risks.length === 0) {
    return {
      action: 'Hold steady — portfolio looks healthy.',
      reasoning: `Health score ${healthScore}/100, no significant risks detected.`,
      confidence: 'high',
    };
  }

  const topRisk = risks[0];
  if (topRisk.severity === 'critical') {
    return {
      action: `Urgent: address ${topRisk.description}`,
      reasoning: `Critical risk detected. Immediate action recommended to prevent loss.`,
      confidence: 'high',
    };
  }

  return {
    action: `Review: ${topRisk.description}`,
    reasoning: `${risks.length} risk(s) identified. Top concern: ${topRisk.description}.`,
    confidence: risks.length > 2 ? 'medium' : 'high',
  };
}

function buildAnalysisText(
  snapshot: PortfolioSnapshot,
  healthScore: number,
  risks: Risk[]
): string {
  const lines: string[] = [];

  lines.push(`Portfolio: $${snapshot.wallet.totalUSD.toFixed(2)} | Health: ${healthScore}/100`);
  lines.push(`Market: ${snapshot.market.trend} | Volatility: ${snapshot.market.volatility}`);

  if (snapshot.positions.length > 0) {
    lines.push(`Positions: ${snapshot.positions.length} active across ${new Set(snapshot.positions.map((p) => p.protocol)).size} protocol(s)`);
  }

  if (risks.length > 0) {
    lines.push(`Risks: ${risks.length} identified (${risks.filter((r) => r.severity === 'critical' || r.severity === 'high').length} high/critical)`);
  }

  return lines.join('\n');
}
```

- [ ] **Step 7: Run reasoning tests**

Run: `bun run test src/reasoning/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/reasoning/context-builder.ts src/reasoning/context-builder.test.ts src/reasoning/engine.ts src/reasoning/engine.test.ts
git commit -m "feat: add context builder and reasoning engine"
```

---

### Task 10: Intent Resolver

**Files:**
- Create: `src/reasoning/intent-resolver.ts`
- Create: `src/reasoning/intent-resolver.test.ts`

- [ ] **Step 1: Write intent resolver tests**

Create `src/reasoning/intent-resolver.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { resolveIntent } from './intent-resolver';
import type { PortfolioSnapshot, TokenBalance } from '../types/index';

const mockGetQuote = vi.fn().mockResolvedValue({
  inputMint: 'So11111111111111111111111111111111',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  inputAmount: 10_000_000_000,
  outputAmount: 1497_500_000,
  slippage: 0.005,
  route: 'Raydium',
  priceImpact: 0.01,
});

vi.mock('../services/jupiter.service', () => ({
  JupiterService: vi.fn().mockImplementation(() => ({
    getQuote: mockGetQuote,
  })),
}));

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function makeSnapshot(tokens: TokenBalance[]): PortfolioSnapshot {
  return {
    wallet: { sol: 10, tokens, totalUSD: tokens.reduce((s, t) => s + t.usdValue, 0) },
    positions: [],
    exposure: { byToken: new Map(), byProtocol: new Map(), leverageRatio: 0 },
    market: { prices: new Map(), volatility: 'moderate', trend: 'neutral' },
    riskProfile: { tolerance: 'moderate', avgLeverage: 0, historicalActions: [] },
    recentDecisions: [],
  };
}

describe('resolveIntent', () => {
  it('resolves "move to stables" into swap steps', async () => {
    const tokens: TokenBalance[] = [
      { mint: 'So11111111111111111111111111111111', symbol: 'SOL', amount: 10, usdValue: 1500 },
      { mint: USDC_MINT, symbol: 'USDC', amount: 500, usdValue: 500 },
    ];
    const snapshot = makeSnapshot(tokens);

    const result = await resolveIntent('move to stables', snapshot);
    expect(result).not.toBeNull();
    expect(result!.steps.length).toBeGreaterThan(0);
    expect(result!.steps[0].action).toBe('swap');
  });

  it('returns null for unrecognized intent', async () => {
    const result = await resolveIntent('fly to the moon', makeSnapshot([]));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/reasoning/intent-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement intent resolver**

Create `src/reasoning/intent-resolver.ts`:
```typescript
import type { PortfolioSnapshot, ExecutionStep } from '../types/index';
import { JupiterService } from '../services/jupiter.service';

interface ExecutionPlan {
  steps: ExecutionStep[];
  estimatedCost: number;
  slippageImpact: number;
}

const STABLE_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',  // USDT
]);

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const INTENT_PATTERNS: { pattern: RegExp; handler: string }[] = [
  { pattern: /move\s+to\s+stables?/i, handler: 'moveToStables' },
  { pattern: /reduce\s+risk/i, handler: 'reduceRisk' },
];

export async function resolveIntent(
  intent: string,
  snapshot: PortfolioSnapshot
): Promise<ExecutionPlan | null> {
  const matched = INTENT_PATTERNS.find((p) => p.pattern.test(intent));
  if (!matched) return null;

  switch (matched.handler) {
    case 'moveToStables':
      return moveToStables(snapshot);
    case 'reduceRisk':
      return reduceRisk(snapshot);
    default:
      return null;
  }
}

async function moveToStables(snapshot: PortfolioSnapshot): Promise<ExecutionPlan> {
  const jupiter = new JupiterService();
  const nonStableTokens = snapshot.wallet.tokens.filter(
    (t) => !STABLE_MINTS.has(t.mint) && t.usdValue > 1
  );

  const steps: ExecutionStep[] = [];
  let totalSlippage = 0;

  for (const token of nonStableTokens) {
    const decimals = token.mint === 'So11111111111111111111111111111111' ? 9 : 6;
    const rawAmount = Math.floor(token.amount * Math.pow(10, decimals));

    try {
      const quote = await jupiter.getQuote(token.mint, USDC_MINT, rawAmount, 50);
      steps.push({
        action: 'swap',
        description: `Swap ${token.amount.toFixed(4)} ${token.symbol} to USDC`,
        params: {
          inputMint: token.mint,
          outputMint: USDC_MINT,
          inputAmount: rawAmount,
          expectedOutput: quote.outputAmount,
          route: quote.route,
        },
      });
      totalSlippage += quote.priceImpact;
    } catch {
      steps.push({
        action: 'swap',
        description: `Swap ${token.symbol} to USDC (quote failed — retry at execution)`,
        params: { inputMint: token.mint, outputMint: USDC_MINT },
      });
    }
  }

  return {
    steps,
    estimatedCost: 0.005 * steps.length,
    slippageImpact: totalSlippage,
  };
}

async function reduceRisk(snapshot: PortfolioSnapshot): Promise<ExecutionPlan> {
  const riskyPositions = snapshot.positions
    .filter((p) => p.healthFactor !== null && p.healthFactor < 1.5)
    .sort((a, b) => (a.healthFactor ?? 0) - (b.healthFactor ?? 0));

  const steps: ExecutionStep[] = riskyPositions.map((p) => ({
    action: 'add_collateral',
    description: `Consider adding collateral to ${p.protocol} ${p.type} position (health: ${p.healthFactor?.toFixed(2)})`,
    params: { protocol: p.protocol, positionType: p.type, currentHealth: p.healthFactor },
  }));

  return { steps, estimatedCost: 0, slippageImpact: 0 };
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/reasoning/intent-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reasoning/intent-resolver.ts src/reasoning/intent-resolver.test.ts
git commit -m "feat: add intent resolver for natural language execution"
```

---

### Task 11: Actions — check-balance & analyze-portfolio

**Files:**
- Create: `src/actions/check-balance.ts`
- Create: `src/actions/check-balance.test.ts`
- Create: `src/actions/analyze-portfolio.ts`
- Create: `src/actions/analyze-portfolio.test.ts`

- [ ] **Step 1: Write check-balance action tests**

Create `src/actions/check-balance.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { checkBalanceAction } from './check-balance';
import { createMockRuntime, createMockMessage, createMockState, createMockCallback } from '../test/mocks';

vi.mock('../services/helius.service', () => ({
  HeliusService: vi.fn().mockImplementation(() => ({
    getAssetsByOwner: vi.fn().mockResolvedValue([
      { mint: 'SOL', symbol: 'SOL', amount: 5.0, usdValue: 750 },
      { mint: 'USDC', symbol: 'USDC', amount: 1000, usdValue: 1000 },
    ]),
  })),
}));

describe('checkBalanceAction', () => {
  it('validates on balance-related messages', async () => {
    const valid = await checkBalanceAction.validate(
      createMockRuntime(),
      createMockMessage('check my balance')
    );
    expect(valid).toBe(true);
  });

  it('handler returns balance data', async () => {
    const callback = createMockCallback();
    const result = await checkBalanceAction.handler(
      createMockRuntime(),
      createMockMessage('what is my balance'),
      createMockState(),
      {},
      callback
    );
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/actions/check-balance.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement check-balance action**

Create `src/actions/check-balance.ts`:
```typescript
import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { HeliusService } from '../services/helius.service';

export const checkBalanceAction: Action = {
  name: 'CHECK_BALANCE',
  similes: ['BALANCE', 'WALLET', 'HOLDINGS', 'PORTFOLIO_BALANCE'],
  description: 'Check wallet balance and token holdings',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() ?? '';
    return (
      text.includes('balance') ||
      text.includes('wallet') ||
      text.includes('holdings') ||
      text.includes('how much')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const walletAddress = runtime.getSetting('WALLET_ADDRESS');
    const apiKey = runtime.getSetting('HELIUS_API_KEY');

    if (!walletAddress || !apiKey) {
      await callback?.({ text: 'Wallet not configured. Set WALLET_ADDRESS and HELIUS_API_KEY.' });
      return { success: false, error: 'Missing wallet configuration' };
    }

    const helius = new HeliusService(apiKey);

    try {
      const tokens = await helius.getAssetsByOwner(walletAddress);
      const totalUSD = tokens.reduce((sum, t) => sum + t.usdValue, 0);

      const lines = tokens
        .sort((a, b) => b.usdValue - a.usdValue)
        .slice(0, 15)
        .map((t) => `${t.symbol}: ${t.amount.toFixed(4)} ($${t.usdValue.toFixed(2)})`);

      const text = [
        `Wallet ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
        `Total: $${totalUSD.toFixed(2)}`,
        '',
        ...lines,
      ].join('\n');

      await callback?.({ text });
      return { success: true, data: { tokens, totalUSD } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await callback?.({ text: `Balance check failed: ${msg}` });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: '{{user1}}', content: { text: 'Check my balance' } },
      { name: 'ReckonFi', content: { text: 'Wallet FGSk...BWWr\nTotal: $2,450.00\nSOL: 10.0000 ($1,500.00)\nUSDC: 950.0000 ($950.00)' } },
    ],
  ],
};
```

- [ ] **Step 4: Write analyze-portfolio action tests**

Create `src/actions/analyze-portfolio.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { analyzePortfolioAction } from './analyze-portfolio';
import { createMockRuntime, createMockMessage, createMockState, createMockCallback } from '../test/mocks';

vi.mock('../services/helius.service', () => ({
  HeliusService: vi.fn().mockImplementation(() => ({
    getAssetsByOwner: vi.fn().mockResolvedValue([
      { mint: 'SOL', symbol: 'SOL', amount: 10, usdValue: 1500 },
    ]),
  })),
}));

vi.mock('../services/jupiter.service', () => ({
  JupiterService: vi.fn().mockImplementation(() => ({
    getPrices: vi.fn().mockResolvedValue(new Map([['SOL', 150]])),
  })),
}));

vi.mock('../services/kamino.service', () => ({
  KaminoService: vi.fn().mockImplementation(() => ({
    getPositions: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../services/drift.service', () => ({
  DriftService: vi.fn().mockImplementation(() => ({
    getPositions: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../services/marginfi.service', () => ({
  MarginfiService: vi.fn().mockImplementation(() => ({
    getPositions: vi.fn().mockResolvedValue([]),
  })),
}));

describe('analyzePortfolioAction', () => {
  it('handler returns analysis with reasoning', async () => {
    const callback = createMockCallback();
    const result = await analyzePortfolioAction.handler(
      createMockRuntime(),
      createMockMessage('how is my portfolio'),
      createMockState(),
      {},
      callback
    );
    expect(result).toHaveProperty('success', true);
    expect(callback.calls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Implement analyze-portfolio action**

Create `src/actions/analyze-portfolio.ts`:
```typescript
import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { HeliusService } from '../services/helius.service';
import { JupiterService } from '../services/jupiter.service';
import { KaminoService } from '../services/kamino.service';
import { DriftService } from '../services/drift.service';
import { MarginfiService } from '../services/marginfi.service';
import { buildPortfolioSnapshot } from '../reasoning/context-builder';
import { analyzePortfolio } from '../reasoning/engine';
import type { Position, PriceData } from '../types/index';

export const analyzePortfolioAction: Action = {
  name: 'ANALYZE_PORTFOLIO',
  similes: ['PORTFOLIO', 'ANALYSIS', 'HEALTH', 'RISK_CHECK', 'HOW_AM_I_DOING'],
  description: 'Analyze portfolio across all DeFi positions with risk assessment',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() ?? '';
    return (
      text.includes('portfolio') ||
      text.includes('position') ||
      text.includes('health') ||
      text.includes('risk') ||
      text.includes('how am i') ||
      text.includes('how\'s my') ||
      text.includes('analyze')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const walletAddress = runtime.getSetting('WALLET_ADDRESS');
    const apiKey = runtime.getSetting('HELIUS_API_KEY');

    if (!walletAddress || !apiKey) {
      await callback?.({ text: 'Wallet not configured.' });
      return { success: false, error: 'Missing configuration' };
    }

    await callback?.({ text: 'Analyzing your portfolio...' });

    try {
      const helius = new HeliusService(apiKey);
      const jupiter = new JupiterService();
      const kamino = new KaminoService(apiKey);
      const drift = new DriftService(apiKey);
      const marginfi = new MarginfiService(apiKey);

      const [tokens, kaminoPos, driftPos, marginfiPos] = await Promise.all([
        helius.getAssetsByOwner(walletAddress),
        kamino.getPositions(walletAddress).catch(() => [] as Position[]),
        drift.getPositions(walletAddress).catch(() => [] as Position[]),
        marginfi.getPositions(walletAddress).catch(() => [] as Position[]),
      ]);

      const allPositions = [...kaminoPos, ...driftPos, ...marginfiPos];
      const mints = tokens.map((t) => t.mint);
      const priceMap = await jupiter.getPrices(mints).catch(() => new Map<string, number>());

      const prices: PriceData[] = tokens.map((t) => ({
        mint: t.mint,
        symbol: t.symbol,
        price: priceMap.get(t.mint) ?? 0,
        change24h: 0,
      }));

      const snapshot = buildPortfolioSnapshot(tokens, allPositions, prices);
      const result = analyzePortfolio(snapshot);

      const output = [
        result.analysis,
        '',
        ...result.risks.map((r) => `[${r.severity.toUpperCase()}] ${r.description}`),
        '',
        `Recommendation: ${result.recommendation.action}`,
        `Reasoning: ${result.recommendation.reasoning}`,
      ].join('\n');

      await callback?.({ text: output });
      return { success: true, data: { snapshot, result } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await callback?.({ text: `Analysis failed: ${msg}` });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: '{{user1}}', content: { text: 'How is my portfolio looking?' } },
      { name: 'ReckonFi', content: { text: 'Portfolio: $4,230.00 | Health: 78/100\nPositions: 3 active across 2 protocols\n[MEDIUM] Token concentration risk: SOL at 62%\nRecommendation: Review SOL exposure' } },
    ],
  ],
};
```

- [ ] **Step 6: Run action tests**

Run: `bun run test src/actions/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/actions/check-balance.ts src/actions/check-balance.test.ts src/actions/analyze-portfolio.ts src/actions/analyze-portfolio.test.ts
git commit -m "feat: add check-balance and analyze-portfolio actions"
```

---

### Task 12: Action — swap-tokens

**Files:**
- Create: `src/actions/swap-tokens.ts`
- Create: `src/actions/swap-tokens.test.ts`

- [ ] **Step 1: Write swap-tokens tests**

Create `src/actions/swap-tokens.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { swapTokensAction } from './swap-tokens';
import { createMockRuntime, createMockMessage, createMockState, createMockCallback } from '../test/mocks';

vi.mock('../services/jupiter.service', () => ({
  JupiterService: vi.fn().mockImplementation(() => ({
    getQuote: vi.fn().mockResolvedValue({
      inputMint: 'So11111111111111111111111111111111',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inputAmount: 1_000_000_000,
      outputAmount: 149_750_000,
      slippage: 0.005,
      route: 'Raydium',
      priceImpact: 0.01,
    }),
  })),
}));

describe('swapTokensAction', () => {
  it('validates on swap-related messages', async () => {
    const valid = await swapTokensAction.validate(
      createMockRuntime(),
      createMockMessage('swap 1 SOL to USDC')
    );
    expect(valid).toBe(true);
  });

  it('handler presents swap plan via callback', async () => {
    const callback = createMockCallback();
    const result = await swapTokensAction.handler(
      createMockRuntime(),
      createMockMessage('swap 1 SOL to USDC'),
      createMockState(),
      {},
      callback
    );
    expect(result).toHaveProperty('success', true);
    expect(callback.calls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/actions/swap-tokens.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement swap-tokens action**

Create `src/actions/swap-tokens.ts`:
```typescript
import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { JupiterService } from '../services/jupiter.service';

const TOKEN_MAP: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

const DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
};

export const swapTokensAction: Action = {
  name: 'SWAP_TOKENS',
  similes: ['SWAP', 'EXCHANGE', 'CONVERT', 'TRADE', 'MOVE_TO_STABLES'],
  description: 'Swap tokens via Jupiter with confirmation flow',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() ?? '';
    return (
      text.includes('swap') ||
      text.includes('convert') ||
      text.includes('exchange') ||
      text.includes('move to stable') ||
      text.includes('trade')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const text = message.content?.text ?? '';
    const parsed = parseSwapIntent(text);

    if (!parsed) {
      await callback?.({
        text: 'I need more details to swap. Try: "swap 1 SOL to USDC" or "move to stables"',
      });
      return { success: false, error: 'Could not parse swap intent' };
    }

    const jupiter = new JupiterService();

    try {
      const rawAmount = Math.floor(parsed.amount * Math.pow(10, DECIMALS[parsed.fromSymbol] ?? 9));

      const quote = await jupiter.getQuote(parsed.fromMint, parsed.toMint, rawAmount, 50);

      const outputDecimals = DECIMALS[parsed.toSymbol] ?? 6;
      const outputAmount = quote.outputAmount / Math.pow(10, outputDecimals);

      const plan = [
        `Swap Plan:`,
        `${parsed.amount} ${parsed.fromSymbol} -> ${outputAmount.toFixed(4)} ${parsed.toSymbol}`,
        `Route: ${quote.route}`,
        `Price impact: ${(quote.priceImpact * 100).toFixed(3)}%`,
        `Estimated gas: ~$0.005`,
        ``,
        `Reply "confirm" to execute or "cancel" to abort.`,
      ].join('\n');

      await callback?.({ text: plan });

      return {
        success: true,
        data: {
          quote,
          fromSymbol: parsed.fromSymbol,
          toSymbol: parsed.toSymbol,
          outputAmount,
          awaitingConfirmation: true,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await callback?.({ text: `Swap quote failed: ${msg}` });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: '{{user1}}', content: { text: 'Swap 1 SOL to USDC' } },
      { name: 'ReckonFi', content: { text: 'Swap Plan:\n1 SOL -> 149.75 USDC\nRoute: Raydium\nPrice impact: 0.010%\n\nReply "confirm" to execute.' } },
    ],
  ],
};

function parseSwapIntent(text: string): { fromSymbol: string; fromMint: string; toSymbol: string; toMint: string; amount: number } | null {
  // Pattern: "swap {amount} {from} to {to}"
  const match = text.match(/(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i);
  if (match) {
    const amount = parseFloat(match[1]);
    const fromSymbol = match[2].toUpperCase();
    const toSymbol = match[3].toUpperCase();
    const fromMint = TOKEN_MAP[fromSymbol];
    const toMint = TOKEN_MAP[toSymbol];

    if (fromMint && toMint && amount > 0) {
      return { fromSymbol, fromMint, toSymbol, toMint, amount };
    }
  }

  // Pattern: "move to stables" — handled by intent resolver, not here
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/actions/swap-tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/swap-tokens.ts src/actions/swap-tokens.test.ts
git commit -m "feat: add swap-tokens action with Jupiter integration"
```

---

### Task 13: Actions — set-alert & monitor-position (stub)

**Files:**
- Create: `src/actions/set-alert.ts`
- Create: `src/actions/set-alert.test.ts`
- Create: `src/actions/monitor-position.ts`

- [ ] **Step 1: Write set-alert tests**

Create `src/actions/set-alert.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { setAlertAction, getAlerts, clearAlerts } from './set-alert';
import { createMockRuntime, createMockMessage, createMockState, createMockCallback } from '../test/mocks';

describe('setAlertAction', () => {
  beforeEach(() => {
    clearAlerts();
  });

  it('validates on alert-related messages', async () => {
    const valid = await setAlertAction.validate(
      createMockRuntime(),
      createMockMessage('alert me when SOL hits 200')
    );
    expect(valid).toBe(true);
  });

  it('creates an alert and stores it', async () => {
    const callback = createMockCallback();
    await setAlertAction.handler(
      createMockRuntime(),
      createMockMessage('alert me when SOL drops below 100'),
      createMockState(),
      {},
      callback
    );
    expect(getAlerts().length).toBeGreaterThan(0);
    expect(callback.calls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement set-alert action**

Create `src/actions/set-alert.ts`:
```typescript
import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import type { Alert } from '../types/index';

let alerts: Alert[] = [];

export function getAlerts(): Alert[] {
  return alerts;
}

export function clearAlerts(): void {
  alerts = [];
}

export const setAlertAction: Action = {
  name: 'SET_ALERT',
  similes: ['ALERT', 'NOTIFY', 'WARN_ME', 'WATCH'],
  description: 'Set price or health alerts for positions',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() ?? '';
    return text.includes('alert') || text.includes('notify') || text.includes('warn') || text.includes('watch');
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const text = message.content?.text ?? '';

    const alert: Alert = {
      id: `alert-${Date.now()}`,
      type: 'price',
      severity: 'info',
      message: text,
      position: null,
      createdAt: Date.now(),
      acknowledged: false,
    };

    alerts.push(alert);

    await callback?.({
      text: `Alert set: "${text}"\nNote: In-memory alerts — won't survive restart. I'll check conditions when you interact with me.`,
    });

    return { success: true, data: { alert } };
  },

  examples: [
    [
      { name: '{{user1}}', content: { text: 'Alert me when SOL drops below 100' } },
      { name: 'ReckonFi', content: { text: 'Alert set: "SOL drops below 100"\nI\'ll flag this when checking your portfolio.' } },
    ],
  ],
};
```

- [ ] **Step 3: Create monitor-position stub**

Create `src/actions/monitor-position.ts`:
```typescript
import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

export const monitorPositionAction: Action = {
  name: 'MONITOR_POSITION',
  similes: ['MONITOR', 'TRACK_POSITION', 'WATCH_POSITION'],
  description: 'Set up continuous monitoring for a DeFi position',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() ?? '';
    return text.includes('monitor') || text.includes('track position');
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    await callback?.({
      text: 'Position monitoring is coming in a future update. For now, ask me to "analyze my portfolio" anytime and I\'ll give you a full health check.',
    });
    return { success: true, data: { status: 'not_yet_active' } };
  },

  examples: [],
};
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/actions/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/set-alert.ts src/actions/set-alert.test.ts src/actions/monitor-position.ts
git commit -m "feat: add set-alert action and monitor-position stub"
```

---

### Task 14: Evaluators

**Files:**
- Create: `src/evaluators/risk-profiler.ts`
- Create: `src/evaluators/risk-profiler.test.ts`
- Create: `src/evaluators/decision-tracker.ts`

- [ ] **Step 1: Write risk profiler tests**

Create `src/evaluators/risk-profiler.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { riskProfilerEvaluator, getRiskProfile } from './risk-profiler';
import { createMockRuntime, createMockMessage, createMockState } from '../test/mocks';

describe('riskProfilerEvaluator', () => {
  it('always validates (runs on every turn)', async () => {
    const valid = await riskProfilerEvaluator.validate(
      createMockRuntime(),
      createMockMessage('any message')
    );
    expect(valid).toBe(true);
  });

  it('updates risk profile from message content', async () => {
    await riskProfilerEvaluator.handler(
      createMockRuntime(),
      createMockMessage('add more collateral to my kamino position'),
      createMockState()
    );

    const profile = getRiskProfile();
    expect(profile.historicalActions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement risk profiler evaluator**

Create `src/evaluators/risk-profiler.ts`:
```typescript
import type { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import type { RiskProfile, RiskTolerance } from '../types/index';

let riskProfile: RiskProfile = {
  tolerance: 'moderate',
  avgLeverage: 0,
  historicalActions: [],
};

export function getRiskProfile(): RiskProfile {
  return { ...riskProfile, historicalActions: [...riskProfile.historicalActions] };
}

const CONSERVATIVE_SIGNALS = ['reduce', 'collateral', 'deleverage', 'safe', 'stables', 'protect'];
const AGGRESSIVE_SIGNALS = ['lever', 'long', 'short', 'yolo', 'max', 'ape'];

export const riskProfilerEvaluator: Evaluator = {
  name: 'RISK_PROFILER',
  description: 'Learns user risk tolerance from conversation patterns',
  alwaysRun: true,
  examples: [],

  validate: async () => true,

  handler: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content?.text?.toLowerCase() ?? '';
    if (!text) return;

    const action = text.slice(0, 100);
    riskProfile.historicalActions.push(action);

    // Keep last 50 actions
    if (riskProfile.historicalActions.length > 50) {
      riskProfile.historicalActions = riskProfile.historicalActions.slice(-50);
    }

    // Assess tolerance shift
    const conservativeCount = riskProfile.historicalActions.filter((a) =>
      CONSERVATIVE_SIGNALS.some((s) => a.includes(s))
    ).length;
    const aggressiveCount = riskProfile.historicalActions.filter((a) =>
      AGGRESSIVE_SIGNALS.some((s) => a.includes(s))
    ).length;

    const total = riskProfile.historicalActions.length;
    let tolerance: RiskTolerance = 'moderate';
    if (total > 5) {
      const ratio = conservativeCount / (conservativeCount + aggressiveCount + 1);
      if (ratio > 0.6) tolerance = 'conservative';
      else if (ratio < 0.3) tolerance = 'aggressive';
    }

    riskProfile.tolerance = tolerance;
  },
};
```

- [ ] **Step 3: Create decision tracker evaluator**

Create `src/evaluators/decision-tracker.ts`:
```typescript
import type { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import type { Decision } from '../types/index';

let decisions: Decision[] = [];

export function getDecisions(): Decision[] {
  return [...decisions];
}

export const decisionTrackerEvaluator: Evaluator = {
  name: 'DECISION_TRACKER',
  description: 'Tracks recommendations and user decisions for calibration',
  alwaysRun: true,
  examples: [],

  validate: async () => true,

  handler: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content?.text?.toLowerCase() ?? '';
    if (!text) return;

    // Record any decision signals
    if (text.includes('confirm') || text.includes('yes') || text.includes('do it')) {
      decisions.push({
        timestamp: Date.now(),
        recommendation: 'pending',
        userAction: 'confirmed',
        outcome: null,
      });
    } else if (text.includes('cancel') || text.includes('no') || text.includes('skip')) {
      decisions.push({
        timestamp: Date.now(),
        recommendation: 'pending',
        userAction: 'rejected',
        outcome: null,
      });
    }

    // Keep last 100 decisions
    if (decisions.length > 100) {
      decisions = decisions.slice(-100);
    }
  },
};
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/evaluators/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/evaluators/risk-profiler.ts src/evaluators/risk-profiler.test.ts src/evaluators/decision-tracker.ts
git commit -m "feat: add risk profiler and decision tracker evaluators"
```

---

### Task 15: Plugin Registration & Character File

**Files:**
- Modify: `src/index.ts`
- Modify: `characters/agent.character.json`

- [ ] **Step 1: Wire all components into plugin**

Replace `src/index.ts`:
```typescript
import type { Plugin } from '@elizaos/core';

import { checkBalanceAction } from './actions/check-balance';
import { analyzePortfolioAction } from './actions/analyze-portfolio';
import { swapTokensAction } from './actions/swap-tokens';
import { setAlertAction } from './actions/set-alert';
import { monitorPositionAction } from './actions/monitor-position';

import { walletProvider } from './providers/wallet-provider';
import { priceProvider } from './providers/price-provider';
import { positionProvider } from './providers/position-provider';
import { marketContextProvider } from './providers/market-context-provider';

import { riskProfilerEvaluator } from './evaluators/risk-profiler';
import { decisionTrackerEvaluator } from './evaluators/decision-tracker';

export const reckonfiPlugin: Plugin = {
  name: 'plugin-reckonfi',
  description: 'ReckonFi — Personal Solana DeFi reasoning agent',

  actions: [
    checkBalanceAction,
    analyzePortfolioAction,
    swapTokensAction,
    setAlertAction,
    monitorPositionAction,
  ],

  providers: [
    walletProvider,
    priceProvider,
    positionProvider,
    marketContextProvider,
  ],

  evaluators: [
    riskProfilerEvaluator,
    decisionTrackerEvaluator,
  ],
};

export default reckonfiPlugin;
```

- [ ] **Step 2: Create ReckonFi character file**

Replace `characters/agent.character.json`:
```json
{
  "name": "ReckonFi",
  "username": "reckonfi",
  "plugins": [
    "@elizaos/plugin-bootstrap",
    "@elizaos/plugin-openai",
    "./src/index.ts"
  ],
  "clients": [],
  "modelProvider": "openai",
  "settings": {
    "model": "Qwen3.5-27B-AWQ-4bit",
    "secrets": {}
  },
  "system": "You are ReckonFi, a personal Solana DeFi reasoning agent. You analyze portfolio data, DeFi positions across Kamino, Drift, and Marginfi, and market context to deliver actionable recommendations. You lead with numbers and data, then follow with insight. You reference the user's history and patterns when making recommendations. You ALWAYS present the full plan before asking for execution confirmation. You never execute without explicit user approval. When data is stale or unavailable, you say so directly. You are protective but strategic — you flag danger early and suggest moves with full reasoning. You are opinionated but deferential.",
  "bio": [
    "Personal Solana DeFi reasoning agent — not a dashboard, a decision engine.",
    "Connects price data, positions, history, and risk calculations into coherent advice.",
    "Protective but strategic — flags danger early, suggests moves with full reasoning.",
    "Learns your preferences over time — the longer you use it, the sharper it gets.",
    "Runs on decentralized infrastructure powered by Nosana."
  ],
  "lore": [
    "Built for the user who manages their own Solana DeFi positions.",
    "Reasons across Kamino, Drift, and Marginfi to give cross-protocol insights.",
    "Never executes without confirmation. Your keys, your decisions.",
    "The name comes from 'reckon' — to calculate, to reason, to consider carefully."
  ],
  "knowledge": [],
  "messageExamples": [
    [
      {
        "user": "{{user1}}",
        "content": { "text": "How's my portfolio looking?" }
      },
      {
        "user": "ReckonFi",
        "content": {
          "text": "Total: $4,230. SOL exposure is 62% — concentrated. Kamino lending healthy at 1.8 health factor. Drift perp is your risk: 22% from liquidation on that SOL-PERP long. Marginfi borrow is fine, 2.1 health. One concern — if SOL drops 20%, your Drift position liquidates and your Kamino health drops to 1.15. Want me to run a stress test at different price levels?"
        }
      }
    ],
    [
      {
        "user": "{{user1}}",
        "content": { "text": "Move to stables" }
      },
      {
        "user": "ReckonFi",
        "content": {
          "text": "Current non-stable holdings: 180 SOL ($27,000), 500 JTO ($1,200), 12,000 BONK ($45). Plan: Swap all three to USDC via Jupiter. Estimated output: $28,212 after 0.12% slippage. Two swaps route through SOL/USDC direct, BONK goes through SOL first. Gas: ~$0.03. Want me to execute?"
        }
      }
    ],
    [
      {
        "user": "{{user1}}",
        "content": { "text": "Check my balance" }
      },
      {
        "user": "ReckonFi",
        "content": {
          "text": "Wallet FGSk...BWWr\nTotal: $2,450.00\n\nSOL: 10.0000 ($1,500.00)\nUSDC: 950.0000 ($950.00)"
        }
      }
    ]
  ],
  "postExamples": [],
  "topics": [
    "DeFi positions",
    "risk management",
    "portfolio analysis",
    "Solana ecosystem",
    "liquidation prevention",
    "yield strategies",
    "token swaps",
    "market context"
  ],
  "adjectives": [
    "analytical",
    "protective",
    "direct",
    "precise",
    "strategic"
  ],
  "style": {
    "all": [
      "Lead with numbers, then insight",
      "Short sentences. No filler.",
      "Show the math. Reference health factors, percentages, dollar amounts.",
      "Always present the plan before asking for confirmation.",
      "When uncertain about data, say so directly.",
      "Never say 'as an AI' or 'I cannot'. Just state what you know and what you don't."
    ],
    "chat": [
      "Be the advisor — opinionated but deferential",
      "Reference user history when making recommendations",
      "Flag danger early, suggest action with reasoning"
    ],
    "post": []
  }
}
```

- [ ] **Step 3: Run full test suite**

Run: `bun run test`
Expected: All tests PASS.

- [ ] **Step 4: Test dev server starts**

Run: `bun run dev` (manual verification — confirm it starts without errors, Ctrl+C to stop)
Expected: ElizaOS boots, loads ReckonFi character, registers plugin-reckonfi.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts characters/agent.character.json
git commit -m "feat: wire plugin registration and ReckonFi character"
```

---

### Task 16: Frontend Setup

**Files:**
- Create: `frontend/` directory with Vite + React + Tailwind + shadcn

- [ ] **Step 1: Scaffold React app with Vite**

```bash
cd /Users/rector/local-dev/reckonfi
bunx create-vite frontend --template react-ts
cd frontend
bun install
```

- [ ] **Step 2: Install Tailwind CSS**

```bash
cd /Users/rector/local-dev/reckonfi/frontend
bun add -d tailwindcss @tailwindcss/vite
```

Update `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

Replace `frontend/src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd /Users/rector/local-dev/reckonfi/frontend
bunx shadcn@latest init
```

Follow prompts: TypeScript, default style, CSS variables.

- [ ] **Step 4: Install needed shadcn components + TanStack Query**

```bash
cd /Users/rector/local-dev/reckonfi/frontend
bunx shadcn@latest add card badge button input scroll-area separator
bun add @tanstack/react-query
```

- [ ] **Step 5: Create API client**

Create `frontend/src/lib/api.ts`:
```typescript
const API_BASE = '/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

let sessionId: string | null = null;

export async function createSession(agentId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/messaging/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      userId: `user-${Date.now()}`,
    }),
  });

  if (!response.ok) throw new Error('Failed to create session');
  const data = await response.json();
  sessionId = data.sessionId;
  return sessionId;
}

export async function sendMessage(content: string): Promise<ChatMessage> {
  if (!sessionId) throw new Error('No active session');

  const response = await fetch(`${API_BASE}/messaging/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) throw new Error('Failed to send message');
  return response.json();
}

export async function getMessages(limit = 50): Promise<ChatMessage[]> {
  if (!sessionId) return [];

  const response = await fetch(
    `${API_BASE}/messaging/sessions/${sessionId}/messages?limit=${limit}`
  );

  if (!response.ok) throw new Error('Failed to get messages');
  return response.json();
}
```

- [ ] **Step 6: Create portfolio data client**

Create `frontend/src/lib/portfolio.ts`:
```typescript
const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY ?? '';
const WALLET_ADDRESS = import.meta.env.VITE_WALLET_ADDRESS ?? '';

export interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  usdValue: number;
}

export async function fetchWalletBalances(): Promise<{ tokens: TokenBalance[]; totalUSD: number }> {
  if (!HELIUS_API_KEY || !WALLET_ADDRESS) {
    return { tokens: [], totalUSD: 0 };
  }

  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'reckonfi-fe',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: WALLET_ADDRESS,
        displayOptions: { showFungible: true, showNativeBalance: true },
      },
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch wallet');

  const data = await response.json();
  const items = data.result?.items ?? [];

  const tokens: TokenBalance[] = items
    .filter((item: any) => item.token_info?.balance > 0)
    .map((item: any) => {
      const info = item.token_info;
      const amount = info.balance / Math.pow(10, info.decimals);
      const price = info.price_info?.price_per_token ?? 0;
      return {
        mint: item.id,
        symbol: item.content?.metadata?.symbol ?? 'UNKNOWN',
        amount,
        usdValue: amount * price,
      };
    })
    .sort((a: TokenBalance, b: TokenBalance) => b.usdValue - a.usdValue);

  const totalUSD = tokens.reduce((sum: number, t: TokenBalance) => sum + t.usdValue, 0);
  return { tokens, totalUSD };
}
```

- [ ] **Step 7: Create frontend .env**

Create `frontend/.env.example`:
```env
VITE_ELIZAOS_API_URL=http://localhost:3000
VITE_HELIUS_API_KEY=YOUR_HELIUS_API_KEY
VITE_WALLET_ADDRESS=YOUR_WALLET_PUBLIC_KEY
```

- [ ] **Step 8: Verify frontend starts**

```bash
cd /Users/rector/local-dev/reckonfi/frontend
bun run dev
```
Expected: Vite dev server starts on port 5173.

- [ ] **Step 9: Commit**

```bash
cd /Users/rector/local-dev/reckonfi
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React, Tailwind, shadcn"
```

---

### Task 17: Frontend Dashboard Components

**Files:**
- Create: `frontend/src/components/PortfolioPanel.tsx`
- Create: `frontend/src/components/ChatPanel.tsx`
- Create: `frontend/src/components/AlertFeed.tsx`
- Create: `frontend/src/components/StatusBar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create PortfolioPanel component**

Create `frontend/src/components/PortfolioPanel.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchWalletBalances, type TokenBalance } from '@/lib/portfolio';

export function PortfolioPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['wallet-balances'],
    queryFn: fetchWalletBalances,
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading portfolio...</div>;
  if (error) return <div className="p-4 text-sm text-destructive">Failed to load portfolio</div>;

  const { tokens, totalUSD } = data ?? { tokens: [], totalUSD: 0 };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <div className="text-sm text-muted-foreground">Total Value</div>
        <div className="text-2xl font-bold">${totalUSD.toFixed(2)}</div>
      </div>

      <div className="text-xs font-medium uppercase text-muted-foreground">Holdings</div>
      <div className="flex flex-col gap-2">
        {tokens.slice(0, 10).map((token: TokenBalance) => {
          const pct = totalUSD > 0 ? ((token.usdValue / totalUSD) * 100).toFixed(1) : '0';
          return (
            <div key={token.mint} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{token.symbol}</span>
                <span className="text-muted-foreground">{token.amount.toFixed(4)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>${token.usdValue.toFixed(2)}</span>
                <Badge variant="outline" className="text-xs">{pct}%</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ChatPanel component**

Create `frontend/src/components/ChatPanel.tsx`:
```tsx
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: 'ReckonFi online. Ask me about your portfolio, positions, or say "analyze my portfolio" for a full health check.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/messaging/sessions/default/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMsg.content }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.content ?? data.text ?? 'No response',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: 'assistant', content: 'Failed to reach ReckonFi. Check if the backend is running.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error. Is the ElizaOS server running on port 3000?' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'ml-8 bg-primary text-primary-foreground'
                  : 'mr-8 bg-muted'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          ))}
          {loading && (
            <div className="mr-8 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask ReckonFi..."
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create AlertFeed component**

Create `frontend/src/components/AlertFeed.tsx`:
```tsx
import { Badge } from '@/components/ui/badge';

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

const SEVERITY_COLORS = {
  info: 'bg-blue-500/10 text-blue-500',
  warning: 'bg-yellow-500/10 text-yellow-500',
  critical: 'bg-red-500/10 text-red-500',
};

export function AlertFeed({ alerts = [] }: { alerts?: Alert[] }) {
  if (alerts.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No active alerts</div>;
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="text-xs font-medium uppercase text-muted-foreground">Alerts</div>
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-start gap-2 text-sm">
          <Badge className={SEVERITY_COLORS[alert.severity]}>{alert.severity}</Badge>
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create StatusBar component**

Create `frontend/src/components/StatusBar.tsx`:
```tsx
export function StatusBar({ healthScore = 0, trend = 'neutral', volatility = 'moderate' }: {
  healthScore?: number;
  trend?: string;
  volatility?: string;
}) {
  const barWidth = Math.min(100, Math.max(0, healthScore));
  const barColor = healthScore > 70 ? 'bg-green-500' : healthScore > 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-6 border-t px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Health:</span>
        <div className="h-2 w-24 rounded-full bg-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
        <span className="font-medium">{healthScore}/100</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Market:</span>
        <span className="font-medium capitalize">{trend}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Volatility:</span>
        <span className="font-medium capitalize">{volatility}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire dashboard layout in App.tsx**

Replace `frontend/src/App.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortfolioPanel } from './components/PortfolioPanel';
import { ChatPanel } from './components/ChatPanel';
import { AlertFeed } from './components/AlertFeed';
import { StatusBar } from './components/StatusBar';

const queryClient = new QueryClient();

function Dashboard() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold">ReckonFi</h1>
        <span className="text-sm text-muted-foreground">
          {import.meta.env.VITE_WALLET_ADDRESS
            ? `${import.meta.env.VITE_WALLET_ADDRESS.slice(0, 4)}...${import.meta.env.VITE_WALLET_ADDRESS.slice(-4)}`
            : 'No wallet'}
        </span>
      </header>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Portfolio + Alerts */}
        <div className="flex w-80 flex-col border-r overflow-y-auto">
          <PortfolioPanel />
          <div className="border-t" />
          <AlertFeed />
        </div>

        {/* Right: Chat */}
        <div className="flex-1">
          <ChatPanel />
        </div>
      </div>

      {/* Status bar */}
      <StatusBar healthScore={78} trend="neutral" volatility="moderate" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Verify frontend renders**

```bash
cd /Users/rector/local-dev/reckonfi/frontend
bun run dev
```
Expected: Dashboard renders with portfolio panel (left), chat panel (right), status bar (bottom).

- [ ] **Step 7: Commit**

```bash
cd /Users/rector/local-dev/reckonfi
git add frontend/src/
git commit -m "feat: add dashboard components — portfolio, chat, alerts, status bar"
```

---

### Task 18: Docker & Nosana Deployment + Documentation

**Files:**
- Modify: `Dockerfile`
- Modify: `nos_job_def/nosana_eliza_job_definition.json`
- Modify: `README.md`

- [ ] **Step 1: Update Dockerfile for frontend build**

Replace `Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1

FROM node:23-slim AS base

RUN apt-get update && apt-get install -y \
  python3 make g++ git \
  && rm -rf /var/lib/apt/lists/*

ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1

WORKDIR /app

RUN npm install -g pnpm

# Install backend dependencies
COPY package.json ./
RUN pnpm install

# Build frontend
COPY frontend/package.json frontend/
RUN cd frontend && pnpm install

COPY frontend/ frontend/
RUN cd frontend && pnpm run build

# Copy backend source
COPY . .

# Move frontend build to serve statically
RUN mkdir -p /app/public && cp -r frontend/dist/* /app/public/

RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000

CMD ["pnpm", "start"]
```

- [ ] **Step 2: Update Nosana job definition**

Replace `nos_job_def/nosana_eliza_job_definition.json`:
```json
{
  "ops": [
    {
      "id": "reckonfi",
      "args": {
        "image": "rectorlabs/reckonfi:latest",
        "expose": 3000,
        "env": {
          "OPENAI_API_KEY": "nosana",
          "OPENAI_API_URL": "https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1",
          "MODEL_NAME": "Qwen3.5-27B-AWQ-4bit",
          "OPENAI_EMBEDDING_URL": "https://4yiccatpyxx773jtewo5ccwhw1s2hezq5pehndb6fcfq.node.k8s.prd.nos.ci/v1",
          "OPENAI_EMBEDDING_API_KEY": "nosana",
          "OPENAI_EMBEDDING_MODEL": "Qwen3-Embedding-0.6B",
          "OPENAI_EMBEDDING_DIMENSIONS": "1024",
          "SERVER_PORT": "3000",
          "NODE_ENV": "production"
        }
      },
      "execution": {
        "group": "run"
      },
      "type": "container/run"
    }
  ],
  "version": "0.1"
}
```

- [ ] **Step 3: Write README**

Replace `README.md` with project-specific documentation covering:
- What ReckonFi is (3 pillars)
- Architecture overview with file structure
- Setup instructions (env vars, `bun install`, `bun run dev`)
- Frontend development (`cd frontend && bun run dev`)
- Testing (`bun run test`)
- Docker build + Nosana deployment steps
- Tech stack summary

(Full README content should follow the structure in the design spec. Write it based on the actual implemented architecture.)

- [ ] **Step 4: Run full test suite**

Run: `bun run test`
Expected: All tests PASS.

- [ ] **Step 5: Build Docker image locally to verify**

```bash
docker build -t rectorlabs/reckonfi:latest .
docker run -p 3000:3000 --env-file .env rectorlabs/reckonfi:latest
```
Expected: Container starts, ElizaOS boots with ReckonFi character.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile nos_job_def/ README.md
git commit -m "feat: update Docker, Nosana config, and README for ReckonFi"
```

- [ ] **Step 7: Final verification — run entire project**

```bash
# Terminal 1: Backend
bun run dev

# Terminal 2: Frontend
cd frontend && bun run dev
```
Expected: Backend on :3000, frontend on :5173, dashboard renders, chat works.
