# ReckonFi — Project Description (300 words)

ReckonFi is a personal Solana DeFi reasoning agent built on ElizaOS v2. It sits between you and your on-chain positions — not as a dashboard, but as a decision engine that reasons across your portfolio to surface risk and suggest action.

## Three Pillars

**Contextual Reasoning** — ReckonFi connects wallet balances, DeFi positions across Kamino, Drift, and Marginfi, token prices via Jupiter, and market context into a single analysis. It computes health factors, liquidation distances, concentration risk, and portfolio health scores using deterministic math — then hands those numbers to the LLM to articulate in plain language.

**Intent-Based Execution** — Say "move to stables" and ReckonFi resolves the optimal path: which tokens to swap, via which route, at what slippage. It presents the full plan before executing. Four intents are supported: move to stables, reduce risk, take profit, and rebalance.

**Adaptive Memory** — ElizaOS evaluators learn your risk tolerance from conversation patterns. Conservative signals (add collateral, deleverage) vs aggressive signals (lever up, ape in) shape a persistent risk profile that calibrates future recommendations.

## Architecture

A domain-split ElizaOS plugin with 6 actions, 4 providers, 2 evaluators, and a dedicated reasoning engine. Services wrap Helius DAS API, Jupiter Price/Swap API, and protocol-specific position parsers. The reasoning engine is fully deterministic — the LLM never computes math, it articulates pre-computed facts.

Users can set any wallet address via chat to monitor any Solana portfolio in real time.

## Tech Stack

ElizaOS v2, TypeScript (strict), Qwen3.5-27B via Nosana, React 19 + Tailwind + shadcn dashboard, 328 tests, Docker on Nosana decentralized GPU network.

## Why ReckonFi

DeFi dashboards show data. ReckonFi reasons about it. It tells you what your numbers mean, what could go wrong, and what to do about it — then waits for your confirmation before acting.
