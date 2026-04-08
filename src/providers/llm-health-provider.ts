import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';

// ---------------------------------------------------------------------------
// State tracking (module-level — shared across all calls in a process)
// ---------------------------------------------------------------------------

type LLMEndpoint = 'primary' | 'fallback';

let activeEndpoint: LLMEndpoint = 'primary';
let fallbackSince: Date | null = null;

/**
 * Perform a lightweight health check against a given base URL.
 * Calls `{baseUrl}/models` with a configurable timeout.
 * Returns true if the response is 2xx, false otherwise.
 */
async function checkEndpointHealth(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Apply a given endpoint configuration to the process environment so that
 * plugin-openai picks up the correct base URL, key, and models.
 */
function applyEndpoint(
  baseUrl: string,
  apiKey: string,
  model: string,
  endpoint: LLMEndpoint
): void {
  process.env.OPENAI_BASE_URL = baseUrl;
  process.env.OPENAI_API_KEY = apiKey;
  process.env.OPENAI_SMALL_MODEL = model;
  process.env.OPENAI_LARGE_MODEL = model;
  activeEndpoint = endpoint;
}

// ---------------------------------------------------------------------------
// llmHealthProvider
// ---------------------------------------------------------------------------

/**
 * ElizaOS provider that monitors LLM endpoint health on every message.
 *
 * - Tests the PRIMARY endpoint with a 3-second timeout on each invocation.
 * - If primary is unreachable and we're currently on primary, switches to
 *   fallback and logs the event with a timestamp.
 * - If primary recovers and we're currently on fallback, switches back and
 *   logs the recovery.
 * - Returns a short status string that is injected into the agent context so
 *   the active endpoint is always visible.
 */
export const llmHealthProvider: Provider = {
  name: 'LLM_HEALTH_PROVIDER',
  description: 'Monitors LLM endpoint health and manages automatic fallback between Nosana and OpenRouter',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<{ text: string; data: { endpoint: LLMEndpoint; fallbackSince: string | null } }> => {
    const primaryUrl = process.env.PRIMARY_LLM_URL;
    const primaryKey = process.env.PRIMARY_LLM_KEY;
    const primaryModel = process.env.PRIMARY_LLM_MODEL;
    const fallbackUrl = process.env.FALLBACK_LLM_URL;
    const fallbackKey = process.env.FALLBACK_LLM_KEY;
    const fallbackModel = process.env.FALLBACK_LLM_MODEL;

    // If the required env vars aren't present, skip health checking entirely.
    if (!primaryUrl || !primaryKey || !primaryModel || !fallbackUrl || !fallbackKey || !fallbackModel) {
      return {
        text: 'LLM: health check skipped (PRIMARY_LLM_URL / FALLBACK_LLM_URL not configured)',
        data: { endpoint: activeEndpoint, fallbackSince: null },
      };
    }

    const primaryHealthy = await checkEndpointHealth(primaryUrl, 3000);
    const now = new Date();

    if (primaryHealthy) {
      if (activeEndpoint === 'fallback') {
        // Primary recovered — switch back
        applyEndpoint(primaryUrl, primaryKey, primaryModel, 'primary');
        fallbackSince = null;
        console.log(
          `[ReckonFi] LLM: Primary endpoint recovered at ${now.toISOString()}, switching back to Nosana`
        );
      } else {
        // Already on primary and still healthy — ensure env vars are current
        applyEndpoint(primaryUrl, primaryKey, primaryModel, 'primary');
      }
    } else {
      if (activeEndpoint === 'primary') {
        // Primary just went down — switch to fallback
        fallbackSince = now;
        applyEndpoint(fallbackUrl, fallbackKey, fallbackModel, 'fallback');
        console.warn(
          `[ReckonFi] LLM: Primary endpoint unreachable at ${now.toISOString()}, switching to fallback (OpenRouter)`
        );
      }
      // Already on fallback — stay on fallback, no duplicate log
    }

    const statusText =
      activeEndpoint === 'primary'
        ? 'LLM: Nosana (primary)'
        : `LLM: OpenRouter (fallback — Nosana down since ${fallbackSince?.toISOString() ?? 'unknown'})`;

    return {
      text: statusText,
      data: {
        endpoint: activeEndpoint,
        fallbackSince: fallbackSince?.toISOString() ?? null,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Exports for testability
// ---------------------------------------------------------------------------

export { checkEndpointHealth, applyEndpoint };
export type { LLMEndpoint };

/** Reset module state — used in tests only. */
export function _resetState(): void {
  activeEndpoint = 'primary';
  fallbackSince = null;
}
