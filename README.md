# ReckonFi — Personal Solana DeFi Reasoning Agent

ReckonFi is a personal AI agent built on ElizaOS v2 that brings structured reasoning to Solana DeFi. Instead of answering in generic terms, ReckonFi reasons through your actual on-chain positions, live market data, and personal risk profile before responding.

Three pillars drive it:

- **Contextual reasoning** — every response is grounded in your current portfolio state, not hypotheticals
- **Intent-based execution** — natural language resolves to concrete on-chain actions (swap, alert, analyze)
- **Adaptive memory** — the agent builds a persistent model of your risk tolerance and past decisions over time

Built for the [Nosana Builders Challenge](https://superteam.fun/earn/listing/nosana-builders-elizaos-challenge/), deployed on Nosana decentralized compute, powered by Qwen3.5-27B.

---

## Architecture

```
reckonfi/
├── src/
│   ├── index.ts                   # Plugin registration entry point
│   ├── types/                     # Shared interfaces and type definitions
│   ├── services/
│   │   ├── solana.ts              # Helius RPC, balance & transaction fetching
│   │   ├── jupiter.ts             # Jupiter swap quotes and execution
│   │   └── protocols.ts           # Kamino, Raydium, MarginFi integrations
│   ├── providers/
│   │   ├── wallet.ts              # Wallet balance and token holdings provider
│   │   ├── price.ts               # Live price context provider
│   │   ├── position.ts            # Open positions aggregator
│   │   └── market.ts              # Market-wide context (dominance, fear/greed)
│   ├── reasoning/
│   │   └── engine.ts              # Multi-step DeFi reasoning chain
│   ├── actions/
│   │   ├── check-balance.ts       # Query wallet balances
│   │   ├── analyze-portfolio.ts   # Full portfolio analysis with risk scoring
│   │   ├── swap-tokens.ts         # Jupiter-routed token swaps
│   │   ├── set-alert.ts           # Price and condition-based alerts
│   │   └── monitor-position.ts    # Ongoing position health monitoring
│   └── evaluators/
│       └── defi-context.ts        # Evaluator that injects DeFi state into context
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
| Runtime | Node.js 23, pnpm |

---

## Quick Start

### Prerequisites

- Node.js 23+
- pnpm (`npm install -g pnpm`)
- A [Helius](https://helius.dev) API key
- Docker (for deployment)

### 1. Environment setup

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

### 2. Install and run

```bash
# Install backend dependencies
bun install

# Start the agent (ElizaOS backend on port 3000)
bun run dev
```

### 3. Frontend development

In a separate terminal:

```bash
cd frontend
bun install
bun run dev
```

Frontend runs on [http://localhost:5173](http://localhost:5173) and proxies `/api` to the agent at port 3000.

---

## Testing

```bash
bun run test
```

Tests are co-located under `src/test/` and use Vitest.

---

## Docker

### Build

```bash
docker build -t rectorlabs/reckonfi:latest .
```

### Test locally

```bash
docker run -p 3000:3000 --env-file .env rectorlabs/reckonfi:latest
```

Visit [http://localhost:3000](http://localhost:3000) to verify the agent responds.

### Push to Docker Hub

```bash
docker login
docker push rectorlabs/reckonfi:latest
```

> The repository must be **public** so Nosana nodes can pull it.

---

## Deploy to Nosana

### Option A: Dashboard (recommended)

1. Visit [dashboard.nosana.com/deploy](https://dashboard.nosana.com/deploy)
2. Connect your Solana wallet
3. Click **Expand** to open the job definition editor
4. Paste the contents of `nos_job_def/nosana_eliza_job_definition.json`
5. Select a compute market (e.g. `nvidia-3090`)
6. Click **Deploy**
7. Once a node picks up the job, you'll receive a public URL

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

- Wallet balance and token holdings lookup (Helius)
- Live portfolio analysis with risk scoring
- Jupiter-routed token swaps from natural language
- Price alerts and position health monitoring
- Multi-step DeFi reasoning chain grounding all responses in on-chain state
- React 19 dashboard with portfolio overview, chat interface, and market context

## Phase 2 Roadmap

- Kamino and MarginFi lending position management
- Automated rebalancing strategies with configurable risk bands
- Persistent risk profile that evolves from conversation history
- Multi-wallet aggregation
- On-chain alert delivery via Telegram or Discord

---

## Resources

- [ElizaOS Documentation](https://elizaos.github.io/eliza/docs)
- [Nosana Documentation](https://docs.nosana.io)
- [Nosana Dashboard](https://dashboard.nosana.com)
- [Jupiter API](https://station.jup.ag/docs)
- [Helius Documentation](https://docs.helius.dev)

---

Built for the [Nosana Builders Challenge](https://superteam.fun/earn/listing/nosana-builders-elizaos-challenge/) · Deployed on Nosana · Powered by Qwen3.5-27B
