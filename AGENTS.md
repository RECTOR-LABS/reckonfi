<!-- Satellite context file — extends the global hub (~/.claude/CLAUDE.md | ~/.pi/agent/AGENTS.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# ReckonFi

> Personal Solana DeFi reasoning agent built on ElizaOS v2. Brings structured reasoning to Solana DeFi — reasons through your actual on-chain positions, live market data, and personal risk profile before responding.

## How it works (three pillars)

1. **Contextual Reasoning** — every reply grounded in live portfolio state (wallet balances, open DeFi positions, price data, market context) fetched in parallel and assembled into a typed `PortfolioSnapshot` before any reasoning. The LLM never speculates; it works from facts.
2. (See `README.md` for pillars 2 + 3 — risk profiling + reasoning chain.)

## Stack

ElizaOS v2 (`@elizaos/core`, `@elizaos/plugin-{anthropic,bootstrap,openai}`) · Solana (`@solana/web3.js`, `@solana/spl-token`, `bs58`) · TypeScript · Vitest · Docker · Nosana (`nos_job_def`).

## Common Commands

```bash
bun install            # bun.lock present
bun start · bun build · bun dev
bun test · bun test:watch
```

## Structure

`src/` · `characters/` (ElizaOS character defs) · `frontend/` · `docs/` · `assets/` · `nos_job_def` (Nosana job) · `Dockerfile` · `vitest.config.ts`.

## Notes

- Deployed via Nosana (decentralized compute) — see `nos_job_def`.
- Package name `nosana-eliza-agent` (internal), branded ReckonFi.