import type { Plugin, IAgentRuntime } from '@elizaos/core';

import { checkBalanceAction } from './actions/check-balance';
import { analyzePortfolioAction } from './actions/analyze-portfolio';
import { swapTokensAction } from './actions/swap-tokens';
import { setAlertAction } from './actions/set-alert';
import { monitorPositionAction } from './actions/monitor-position';
import { setWalletAction } from './actions/set-wallet';

import { walletProvider } from './providers/wallet-provider';
import { priceProvider } from './providers/price-provider';
import { positionProvider } from './providers/position-provider';
import { marketContextProvider } from './providers/market-context-provider';
import { llmHealthProvider } from './providers/llm-health-provider';

import { riskProfilerEvaluator } from './evaluators/risk-profiler';
import { decisionTrackerEvaluator } from './evaluators/decision-tracker';

// ---------------------------------------------------------------------------
// LLM endpoint probe — called once on plugin init
// ---------------------------------------------------------------------------

/**
 * Probes the PRIMARY_LLM_URL /models endpoint with a 5-second timeout.
 * Sets OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_SMALL_MODEL, and
 * OPENAI_LARGE_MODEL to whichever endpoint responds, so that plugin-openai
 * picks up the correct configuration without any internal changes.
 */
async function selectLLMEndpoint(): Promise<void> {
  const primaryUrl = process.env.PRIMARY_LLM_URL;
  const primaryKey = process.env.PRIMARY_LLM_KEY;
  const primaryModel = process.env.PRIMARY_LLM_MODEL;
  const fallbackUrl = process.env.FALLBACK_LLM_URL;
  const fallbackKey = process.env.FALLBACK_LLM_KEY;
  const fallbackModel = process.env.FALLBACK_LLM_MODEL;

  // If the fallback vars aren't configured, leave existing env untouched.
  if (!primaryUrl || !primaryKey || !primaryModel || !fallbackUrl || !fallbackKey || !fallbackModel) {
    console.log('[ReckonFi] LLM: fallback not configured — using existing OPENAI_* env vars');
    return;
  }

  const url = `${primaryUrl.replace(/\/$/, '')}/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      process.env.OPENAI_BASE_URL = primaryUrl;
      process.env.OPENAI_API_KEY = primaryKey;
      process.env.OPENAI_SMALL_MODEL = primaryModel;
      process.env.OPENAI_LARGE_MODEL = primaryModel;
      console.log('[ReckonFi] LLM: Using primary endpoint (Nosana)');
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err: unknown) {
    const reason =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'timeout (5s)'
          : err.message
        : String(err);

    process.env.OPENAI_BASE_URL = fallbackUrl;
    process.env.OPENAI_API_KEY = fallbackKey;
    process.env.OPENAI_SMALL_MODEL = fallbackModel;
    process.env.OPENAI_LARGE_MODEL = fallbackModel;
    console.warn(
      `[ReckonFi] LLM: Primary endpoint failed (${reason}), using fallback (OpenRouter) — ${new Date().toISOString()}`
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

export const reckonfiPlugin: Plugin = {
  name: 'plugin-reckonfi',
  description: 'ReckonFi — Personal Solana DeFi reasoning agent',

  init: async (_config: Record<string, string>, _runtime: IAgentRuntime): Promise<void> => {
    await selectLLMEndpoint();
  },

  actions: [checkBalanceAction, analyzePortfolioAction, swapTokensAction, setAlertAction, monitorPositionAction, setWalletAction],
  providers: [walletProvider, priceProvider, positionProvider, marketContextProvider, llmHealthProvider],
  evaluators: [riskProfilerEvaluator, decisionTrackerEvaluator],
};

export default reckonfiPlugin;
