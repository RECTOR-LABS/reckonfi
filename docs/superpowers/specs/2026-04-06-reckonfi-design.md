# ReckonFi — Design Specification

Personal Solana DeFi reasoning agent built on ElizaOS v2 for the Nosana Builders Challenge.

## Overview

ReckonFi is a reasoning layer between the user and Solana DeFi. Not a dashboard or chatbot — a decision engine that reasons across multiple data sources to produce actionable recommendations.

### Three Pillars

1. **Contextual Reasoning** — Connects price data, positions, history, and risk calculations. Produces insights like "SOL dropped 12%, your Kamino position is 18% from liquidation, you usually add collateral at 20%."
2. **Intent-Based Execution** — User expresses intent ("move to stables"), ReckonFi resolves the optimal execution path, presents the plan, user confirms, agent executes.
3. **Adaptive Memory** — ElizaOS evaluators build a persistent profile of preferences, risk tolerance, and behavioral patterns. Improves over time.

### Key Decisions

| Decision | Choice |
|----------|--------|
| Scope | Full vision, phased delivery — stubs acceptable for Phase 1 |
| Wallet access | Read + execute with confirmation. Mainnet read, devnet execute for demos |
| DeFi protocols | Kamino + Drift + Marginfi read-only. Jupiter for swap execution |
| Frontend | Standalone React app (Vite + Tailwind + shadcn) with embedded chat |
| Data sources | Multi-source: Helius (wallet/tx), Jupiter (prices/swaps), protocol SDKs (positions) |
| Alerts | In-app only (dashboard alert feed + chat notifications) |
| Personality | Advisor — opinionated with reasoning, always defers to user for execution |
| Architecture | Domain-split single plugin with dedicated reasoning module |

## Tech Stack

- **Runtime:** ElizaOS v2, Node.js 23+, bun
- **LLM:** Qwen3.5-27B-AWQ-4bit via Nosana (OpenAI-compatible, 60K context, text-only)
- **Frontend:** React 19 + Vite, Tailwind CSS, shadcn/ui, TanStack Query, recharts
- **Deployment:** Docker on Nosana decentralized GPU network
- **Language:** TypeScript, strict mode

## Plugin Architecture

Single plugin `plugin-reckonfi` with domain-split internal structure:

```
src/
  index.ts                         — Plugin export (registers all components)
  actions/
    swap-tokens.ts                 — Jupiter swap with confirmation flow
    check-balance.ts               — Wallet balance + token breakdown
    analyze-portfolio.ts           — Cross-protocol position analysis
    monitor-position.ts            — Position monitoring setup
    set-alert.ts                   — Price/health alert configuration
  providers/
    wallet-provider.ts             — SOL + SPL balances, recent txs
    price-provider.ts              — Jupiter Price API, token metadata
    position-provider.ts           — Kamino/Drift/Marginfi position aggregation
    market-context-provider.ts     — Volatility, trend, volume context
  evaluators/
    risk-profiler.ts               — Learns risk tolerance from user decisions
    decision-tracker.ts            — Tracks recommendations vs outcomes
  services/
    solana.service.ts              — RPC connection, tx building/signing
    jupiter.service.ts             — Price feeds, swap routing, quote API
    helius.service.ts              — DAS API, transaction history
    kamino.service.ts              — Kamino position parsing
    drift.service.ts               — Drift position parsing
    marginfi.service.ts            — Marginfi position parsing
  reasoning/
    engine.ts                      — Core: data -> analysis -> recommendation
    risk-calculator.ts             — Liquidation distance, health factor math
    intent-resolver.ts             — Natural language intent -> execution plan
    context-builder.ts             — Assembles PortfolioSnapshot from all providers
  types/
    index.ts                       — Shared interfaces
frontend/
  src/
    ... (React app)
```

## Data Flow

```
User message
  -> ElizaOS runtime (providers inject wallet/price/position/market context)
  -> LLM decides which action to invoke
  -> Action calls reasoning/context-builder
    -> context-builder pulls from ALL providers
    -> reasoning/engine analyzes combined context
    -> reasoning/risk-calculator computes health metrics
  -> Action returns structured ReasoningResult to LLM
  -> LLM formats response in ReckonFi's advisor voice
  -> Evaluators run post-response (risk-profiler + decision-tracker update memory)
```

Key design principle: the reasoning engine computes deterministic values (health factors, liquidation distances, portfolio percentages). The LLM articulates those values in natural language. The LLM never computes math — it receives pre-computed facts.

## Services

### Solana Service
- `getBalance(address)` — SOL + all SPL tokens
- `getTransactionHistory(address, limit)` — Recent txs via Helius
- `buildAndSendTransaction(instructions, signer)` — With user confirmation gate
- `estimatePriorityFee()` — Via Helius priority fee API

**Wallet keypair:** Private key loaded from env var (`SOLANA_PRIVATE_KEY`). Never logged, never sent to LLM. Used only by the Solana service for signing confirmed transactions. Read-only operations use the public address only.

### Helius Service
- `getAssetsByOwner(address)` — All tokens + NFTs via DAS API
- `getTransactionHistory(address)` — Parsed, enriched transaction history
- `getAsset(mint)` — Token metadata

### Jupiter Service
- `getPrice(mints[])` — Batch price lookup via Price API v2
- `getQuote(inputMint, outputMint, amount, slippage)` — Swap quote with route
- `buildSwapTransaction(quote)` — Ready-to-sign transaction
- `getTokenList()` — Verified token registry

### Protocol Services

All protocol services implement a shared interface:

```typescript
interface ProtocolService {
  getPositions(walletAddress: string): Promise<Position[]>
  getHealthFactor(position: Position): Promise<number>
  getLiquidationPrice(position: Position): Promise<number | null>
  getAPY(position: Position): Promise<number>
}
```

- **Kamino:** `@kamino-finance/klend-sdk` — deposits, borrows, health factor, liquidation threshold
- **Drift:** `@drift-labs/sdk` — perp + spot positions, unrealized PnL, margin ratio, liquidation price
- **Marginfi:** `@mrgnlabs/marginfi-client-v2` — deposits, borrows, account health

## Shared Types

```typescript
interface Position {
  protocol: 'kamino' | 'drift' | 'marginfi'
  type: 'lending' | 'borrowing' | 'perp-long' | 'perp-short' | 'lp'
  tokens: TokenAmount[]
  value: number                     // USD value
  healthFactor: number | null       // 1.0 = at liquidation
  liquidationPrice: number | null
  pnl: number                      // Unrealized PnL in USD
  apy: number                      // Current APY/APR
  metadata: Record<string, unknown> // Protocol-specific extras
}

interface PortfolioSnapshot {
  wallet: { sol: number; tokens: TokenBalance[]; totalUSD: number }
  positions: Position[]
  exposure: {
    byToken: Map<string, number>     // % of portfolio per token
    byProtocol: Map<string, number>  // % per protocol
    leverageRatio: number            // Total borrowed / total deposited
  }
  market: {
    prices: Map<string, PriceData>
    volatility: 'low' | 'moderate' | 'high' | 'extreme'
    trend: 'bullish' | 'neutral' | 'bearish'
  }
  riskProfile: RiskProfile
  recentDecisions: Decision[]
}

interface ReasoningResult {
  analysis: string
  risks: Risk[]
  recommendation: {
    action: string
    reasoning: string
    confidence: 'low' | 'medium' | 'high'
  }
  executionPlan?: {
    steps: ExecutionStep[]
    estimatedCost: number
    slippageImpact: number
  }
}
```

## Reasoning Engine

### Context Builder
Assembles `PortfolioSnapshot` by pulling from all providers. Single source of truth for any reasoning operation.

### Risk Calculator
Pure deterministic math — no LLM:
- `portfolioHealthScore()` — Weighted health across all positions (0-100)
- `liquidationDistance(position)` — % price move to trigger liquidation
- `concentrationRisk()` — Herfindahl index across tokens/protocols
- `drawdownEstimate(volatility, exposure)` — Estimated max loss at current exposure

### Reasoning Engine
Takes `PortfolioSnapshot` + user context, produces structured `ReasoningResult`. Does not call the LLM — outputs data for the LLM to articulate.

### Intent Resolver
Maps natural language intents to concrete execution plans:

| Intent | Resolution |
|--------|-----------|
| "move to stables" | Identify non-stable tokens -> Jupiter quotes -> optimal split -> execution plan |
| "reduce risk" | Find highest-risk positions -> recommend: add collateral, partial close, or deleverage |
| "take profit on SOL" | Check SOL exposure -> amount based on risk profile -> Jupiter swap plan |
| "rebalance" | Compare current allocation vs. profile preferences -> generate rebalancing trades |

## Character

- **Name:** ReckonFi
- **Voice:** Advisor — leads with numbers, follows with insight, references user history
- **Style:** Short sentences. No filler. Shows the math. Always presents the plan before asking for confirmation.
- **Personality:** Protective but strategic. Opinionated but deferential. Flags danger early, suggests moves with full reasoning.
- **When uncertain:** Says so directly. "Can't reach Kamino right now — reasoning from cached data (12 min old)."

Example interactions:

> **User:** How's my portfolio looking?
> **ReckonFi:** Total: $4,230. SOL exposure is 62% — concentrated. Kamino lending healthy at 1.8 health factor. Drift perp is your risk: 22% from liquidation on that SOL-PERP long. Marginfi borrow is fine, 2.1 health. One concern — if SOL drops 20%, your Drift position liquidates and your Kamino health drops to 1.15. Want me to run a stress test at different price levels?

> **User:** Move to stables
> **ReckonFi:** Current non-stable holdings: 180 SOL ($27,000), 500 JTO ($1,200), 12,000 BONK ($45). Plan: Swap all three to USDC via Jupiter. Estimated output: $28,212 after 0.12% slippage. Two swaps route through SOL/USDC direct, BONK goes through SOL first. Gas: ~$0.03. Want me to execute?

## Frontend

### Stack
React 19 + Vite, Tailwind CSS + shadcn/ui, TanStack Query, recharts/lightweight-charts.
Lives in `frontend/` directory, independent from ElizaOS backend.

### Layout — Three-Panel Dashboard

```
+----------------------------------------------------------+
|  ReckonFi                              [wallet: Fg...Wr] |
+--------------------+-------------------------------------+
|                    |                                     |
|  PORTFOLIO PANEL   |         CHAT PANEL                  |
|                    |                                     |
|  Total: $4,230     |  ReckonFi: Health looking good      |
|  > SOL  62%        |  across the board. Drift perp is    |
|  > USDC 28%        |  your closest watch...              |
|  > JTO  10%        |                                     |
|                    |  [You]: move to stables             |
|  POSITIONS         |                                     |
|  +----------+      |  ReckonFi: Plan ready. 3 swaps...   |
|  | Kamino 1.8h |   |  [Confirm] [Modify] [Cancel]       |
|  | Drift  1.4h |   |                                     |
|  | Mrgfi  2.1h |   |                                     |
|  +----------+      |                                     |
|                    |                                     |
|  ALERTS            |                                     |
|  ! Drift 22% liq   |                                     |
|  * SOL -4.2% 24h   |                                     |
|                    |                                     |
+--------------------+-------------------------------------+
|  Portfolio Health: ========-- 78/100    Market: Neutral  |
+----------------------------------------------------------+
```

### Left Panel — Portfolio
- Total USD value with token allocation breakdown
- Position cards per protocol: health factor, value, PnL (color-coded green/yellow/red)
- Alert feed: scrolling list of active warnings, severity-colored

### Right Panel — Chat
- Chat interface via ElizaOS REST API (`POST /api/agents/:id/message`)
- Inline action confirmation cards with [Confirm] [Modify] [Cancel]
- Markdown rendering for formatted responses

### Bottom Bar
- Portfolio health score (0-100, from reasoning engine)
- Market context indicator (trend + volatility)

### Data Fetching
- Chat: ElizaOS REST API
- Portfolio panels: Direct RPC/Helius/Jupiter calls from frontend (avoids LLM round-trip for dashboard data). Helius API key stored in frontend env vars — acceptable since this is a single-user personal agent, not a public app.
- TanStack Query handles caching, polling intervals, stale data

### Responsive
Desktop-first (power-user tool). Panels stack vertically on narrow screens.

## Delivery Phases

### Phase 1 — Core Foundation

**Fully working:**
- ReckonFi character with advisor personality
- `wallet-provider` — live SOL + SPL balances via Helius
- `price-provider` — real-time prices via Jupiter
- `position-provider` — Kamino positions (deepest integration)
- `market-context-provider` — basic trend + volatility signals
- `analyze-portfolio` action — full cross-protocol analysis
- `check-balance` action — wallet breakdown
- `swap-tokens` action — Jupiter swap with confirmation flow
- Reasoning engine core — context builder, risk calculator, portfolio health
- `risk-profiler` evaluator — basic risk preference tracking
- Frontend dashboard — portfolio panel, chat panel, alert feed
- Docker image + Nosana deployment
- README with architecture documentation

**Functional but shallow:**
- Drift + Marginfi position reading (basic parsing, less depth than Kamino)
- `set-alert` action — in-memory alerts, cleared on restart
- `decision-tracker` evaluator — records decisions, minimal learning
- Intent resolver — "move to stables" works, others scaffolded

**Scaffolded (interface exists, stub implementation):**
- `monitor-position` action — returns graceful "not yet active" message
- Advanced intent resolution ("rebalance", "take profit")
- Historical PnL tracking

### Phase 2 — Deep Integration
- Deep Drift + Marginfi integration with full SDK usage
- Persistent alerts (survive restart)
- Full intent library (rebalance, take profit, hedge)
- Telegram notifications via `@elizaos/plugin-telegram`
- Historical PnL charts in frontend
- Evaluator refinement with real usage data
- Advanced stress testing (multi-scenario simulation)
