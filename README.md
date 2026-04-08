# ReckonFi — Personal Solana DeFi Reasoning Agent

ReckonFi is a personal AI agent built on ElizaOS v2 that brings structured reasoning to Solana DeFi. Instead of answering in generic terms, ReckonFi reasons through your actual on-chain positions, live market data, and personal risk profile before responding.

---

## How It Works

Three pillars drive every response:

**1. Contextual Reasoning**
Every reply is grounded in your live portfolio state — wallet balances, open DeFi positions, price data, and market context are fetched in parallel and assembled into a typed `PortfolioSnapshot` before any reasoning begins. The LLM never speculates; it works from facts.

**2. Intent-Based Execution**
Natural language resolves to concrete on-chain actions. Phrases like "move to stables", "reduce risk", "take profit on SOL", or "rebalance" map to typed `ExecutionPlan` objects with swap steps, cost estimates, and slippage projections — ready to execute.

**3. Adaptive Memory**
The risk profiler evaluator runs on every message, tracking your language patterns to infer risk tolerance (`conservative`, `moderate`, `aggressive`). This learned profile feeds into every portfolio snapshot, so recommendations adapt to how you actually behave over time — not just what you say once.

---

## Architecture

```
User Input
    │
    ▼
ElizaOS Runtime
    │
    ├── Providers (run in parallel, inject context)
    │   ├── Wallet Provider      → token balances via Helius
    │   ├── Price Provider       → live prices via Jupiter
    │   ├── Position Provider    → Kamino / Drift / MarginFi positions
    │   └── Market Provider      → volatility, trend, fear/greed index
    │
    ├── LLM selects Action
    │   └── analyzePortfolioAction / swapTokensAction / setAlertAction / ...
    │
    └── Action Handler
            │
            ├── Reasoning Engine
            │   ├── Context Builder   → assembles PortfolioSnapshot
            │   ├── Risk Calculator   → health factors, liquidation proximity
            │   └── Intent Resolver   → natural language → ExecutionPlan
            │
            ├── ReasoningResult
            │   ├── analysis string
            │   ├── risk array (severity + description)
            │   └── recommendation (action, reasoning, confidence)
            │
            └── LLM articulates result in ReckonFi voice
                        │
                        ▼
                Evaluators (learn from interaction)
                └── Risk Profiler  → updates tolerance model from message history
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent framework | ElizaOS v2 (`@elizaos/core` ^1.0.0) |
| LLM | Qwen3.5-27B-AWQ-4bit via Nosana inference |
| Embeddings | Qwen3-Embedding-0.6B (1024 dimensions) |
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| UI components | shadcn/ui, Radix UI, Lucide |
| Solana RPC | Helius (`@solana/web3.js` v1) |
| DEX routing | Jupiter v6 (`@jup-ag/api`) |
| Database | SQLite (via ElizaOS built-in adapter) |
| Compute | Nosana decentralized GPU network |
| Runtime | Bun, pnpm |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 23+
- pnpm (`npm install -g pnpm`) — used by ElizaOS internals
- A [Helius](https://helius.dev) API key (free tier works)
- Docker — only needed for deployment

### 1. Clone and install

```bash
git clone https://github.com/RECTOR-LABS/reckonfi.git
cd reckonfi
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# LLM — Nosana hosted endpoint
OPENAI_API_KEY=nosana
OPENAI_API_URL=https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1
MODEL_NAME=Qwen3.5-27B-AWQ-4bit

# Embeddings
OPENAI_EMBEDDING_URL=https://4yiccatpyxx773jtewo5ccwhw1s2hezq5pehndb6fcfq.node.k8s.prd.nos.ci/v1
OPENAI_EMBEDDING_API_KEY=nosana
OPENAI_EMBEDDING_MODEL=Qwen3-Embedding-0.6B
OPENAI_EMBEDDING_DIMENSIONS=1024

# Solana
WALLET_ADDRESS=<your-solana-wallet-pubkey>
HELIUS_API_KEY=<your-helius-api-key>
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your-helius-api-key>
SOLANA_PRIVATE_KEY=<base58-private-key>
```

> The Nosana inference endpoints above are the public shared endpoints from the Nosana Builders Challenge. For production use, deploy your own model on Nosana and replace these URLs.

### 3. Start the agent

```bash
bun run dev
```

The ElizaOS backend starts on [http://localhost:3000](http://localhost:3000).

### 4. Start the frontend (optional)

In a separate terminal:

```bash
cd frontend
bun install
bun run dev
```

Frontend runs on [http://localhost:5173](http://localhost:5173) and proxies `/api` to the agent.

---

## Testing

```bash
bun run test
```

Tests live under `src/**/*.test.ts` and use Vitest. Each service, provider, action, and reasoning component has dedicated test coverage.

---

## Project Structure

```
reckonfi/
├── src/
│   ├── index.ts                   # Plugin registration entry point
│   ├── types/                     # Shared interfaces and type definitions
│   ├── services/
│   │   ├── helius.service.ts      # Helius RPC — balances and asset fetching
│   │   ├── jupiter.service.ts     # Jupiter swap quotes and price feeds
│   │   ├── kamino.service.ts      # Kamino lending positions
│   │   ├── drift.service.ts       # Drift perpetuals positions
│   │   └── marginfi.service.ts    # MarginFi lending positions
│   ├── providers/
│   │   ├── wallet-provider.ts     # Wallet balance and token holdings
│   │   ├── price-provider.ts      # Live price context
│   │   ├── position-provider.ts   # Open positions aggregator
│   │   └── market-context-provider.ts  # Market-wide context
│   ├── reasoning/
│   │   ├── engine.ts              # Portfolio analysis and risk scoring
│   │   ├── context-builder.ts     # Assembles PortfolioSnapshot from raw data
│   │   ├── intent-resolver.ts     # Natural language → ExecutionPlan
│   │   └── risk-calculator.ts     # Health factor and liquidation checks
│   ├── actions/
│   │   ├── check-balance.ts       # Query wallet balances
│   │   ├── analyze-portfolio.ts   # Full portfolio analysis with risk assessment
│   │   ├── swap-tokens.ts         # Jupiter-routed token swaps
│   │   ├── set-alert.ts           # Price and condition-based alerts
│   │   └── monitor-position.ts    # Ongoing position health monitoring
│   └── evaluators/
│       └── risk-profiler.ts       # Infers user risk tolerance from message history
├── frontend/
│   ├── src/
│   │   ├── components/            # Dashboard, chat, portfolio, market components
│   │   └── App.tsx
│   ├── vite.config.ts
│   └── package.json
├── characters/
│   └── agent.character.json       # ReckonFi agent personality and plugin config
├── nos_job_def/
│   └── nosana_eliza_job_definition.json
├── Dockerfile
└── .env.example
```

---

## Docker

```bash
# Build
docker build -t rectorlabs/reckonfi:latest .

# Test locally
docker run -p 3000:3000 --env-file .env rectorlabs/reckonfi:latest
```

Visit [http://localhost:3000](http://localhost:3000) to verify the agent responds.

```bash
# Push to Docker Hub (repository must be public for Nosana nodes)
docker push rectorlabs/reckonfi:latest
```

---

## Deploy to Nosana

### Option A: Dashboard (recommended)

1. Visit [dashboard.nosana.com/deploy](https://dashboard.nosana.com/deploy)
2. Connect your Solana wallet
3. Click **Expand** to open the job definition editor
4. Paste the contents of `nos_job_def/nosana_eliza_job_definition.json`
5. Select a compute market (e.g. `nvidia-3090`)
6. Click **Deploy**
7. Once a node picks up the job, you receive a public endpoint URL

### Option B: CLI

```bash
npm install -g @nosana/cli

nosana job post \
  --file ./nos_job_def/nosana_eliza_job_definition.json \
  --market nvidia-4090 \
  --timeout 300 \
  --api <YOUR_NOSANA_API_KEY>
```

Get your API key at [deploy.nosana.com/account](https://deploy.nosana.com/account/).

---

## Phase 1 Features

- Wallet balance and token holdings lookup via Helius
- Full portfolio analysis with risk scoring across Kamino, Drift, and MarginFi
- Jupiter-routed token swaps from natural language
- Price alerts and position health monitoring
- Intent resolution: move to stables, reduce risk, take profit, rebalance
- Adaptive risk profiler that learns from your conversation history
- React 19 dashboard with portfolio overview, chat interface, and market context

## Phase 2 Roadmap

- Automated rebalancing with configurable risk bands (execute, not just suggest)
- Multi-wallet aggregation
- On-chain alert delivery via Telegram or Discord
- Persistent cross-session risk profile storage
- Expanded protocol coverage (Raydium, Orca, Jito)

---

## Resources

- [ElizaOS Documentation](https://elizaos.github.io/eliza/docs)
- [Nosana Documentation](https://docs.nosana.io)
- [Nosana Dashboard](https://dashboard.nosana.com)
- [Jupiter API](https://station.jup.ag/docs)
- [Helius Documentation](https://docs.helius.dev)

---

Built for the [Nosana Builders Challenge](https://superteam.fun/earn/listing/nosana-builders-elizaos-challenge/) · Deployed on Nosana · Powered by Qwen3.5-27B
