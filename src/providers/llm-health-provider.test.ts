import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';

// ---------------------------------------------------------------------------
// We spy on the module-level fetch used inside checkEndpointHealth
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  llmHealthProvider,
  checkEndpointHealth,
  _resetState,
} from './llm-health-provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dummyRuntime = {} as IAgentRuntime;
const dummyMessage = {} as Memory;
const dummyState = {} as State;

const PRIMARY_URL = 'https://primary.example.com/v1';
const PRIMARY_KEY = 'nosana';
const PRIMARY_MODEL = 'Qwen/Qwen3.5-4B';
const FALLBACK_URL = 'https://openrouter.ai/api/v1';
const FALLBACK_KEY = 'sk-or-test-key';
const FALLBACK_MODEL = 'google/gemini-2.5-flash';

function setEnvVars(overrides: Record<string, string | undefined> = {}) {
  process.env.PRIMARY_LLM_URL = overrides.PRIMARY_LLM_URL ?? PRIMARY_URL;
  process.env.PRIMARY_LLM_KEY = overrides.PRIMARY_LLM_KEY ?? PRIMARY_KEY;
  process.env.PRIMARY_LLM_MODEL = overrides.PRIMARY_LLM_MODEL ?? PRIMARY_MODEL;
  process.env.FALLBACK_LLM_URL = overrides.FALLBACK_LLM_URL ?? FALLBACK_URL;
  process.env.FALLBACK_LLM_KEY = overrides.FALLBACK_LLM_KEY ?? FALLBACK_KEY;
  process.env.FALLBACK_LLM_MODEL = overrides.FALLBACK_LLM_MODEL ?? FALLBACK_MODEL;
}

function clearEnvVars() {
  delete process.env.PRIMARY_LLM_URL;
  delete process.env.PRIMARY_LLM_KEY;
  delete process.env.PRIMARY_LLM_MODEL;
  delete process.env.FALLBACK_LLM_URL;
  delete process.env.FALLBACK_LLM_KEY;
  delete process.env.FALLBACK_LLM_MODEL;
}

function mockFetchOk() {
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
}

function mockFetchDown() {
  mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
}

function mockFetchNon2xx() {
  mockFetch.mockResolvedValue({ ok: false, status: 503 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('llmHealthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetState();
    setEnvVars();
  });

  afterEach(() => {
    clearEnvVars();
  });

  it('has the correct name', () => {
    expect(llmHealthProvider.name).toBe('LLM_HEALTH_PROVIDER');
  });

  it('has a non-empty description', () => {
    expect(llmHealthProvider.description.length).toBeGreaterThan(0);
  });

  describe('get() — happy path: primary healthy', () => {
    it('returns text indicating primary (Nosana) endpoint is active', async () => {
      mockFetchOk();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toContain('Nosana');
      expect(result.text).toContain('primary');
    });

    it('returns endpoint === "primary" in data', async () => {
      mockFetchOk();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.endpoint).toBe('primary');
    });

    it('returns fallbackSince === null when primary is healthy', async () => {
      mockFetchOk();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.fallbackSince).toBeNull();
    });

    it('sets OPENAI_BASE_URL to PRIMARY_LLM_URL when primary responds', async () => {
      mockFetchOk();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(process.env.OPENAI_BASE_URL).toBe(PRIMARY_URL);
    });
  });

  describe('get() — primary down: switch to fallback', () => {
    it('returns text indicating fallback (OpenRouter) is active', async () => {
      mockFetchDown();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toContain('OpenRouter');
      expect(result.text).toContain('fallback');
    });

    it('returns endpoint === "fallback" in data', async () => {
      mockFetchDown();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.endpoint).toBe('fallback');
    });

    it('returns a non-null fallbackSince timestamp when on fallback', async () => {
      mockFetchDown();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.fallbackSince).not.toBeNull();
      // Should be a valid ISO date string
      expect(() => new Date(result.data.fallbackSince!)).not.toThrow();
    });

    it('sets OPENAI_BASE_URL to FALLBACK_LLM_URL when primary is down', async () => {
      mockFetchDown();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(process.env.OPENAI_BASE_URL).toBe(FALLBACK_URL);
    });

    it('sets OPENAI_API_KEY to FALLBACK_LLM_KEY when primary is down', async () => {
      mockFetchDown();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(process.env.OPENAI_API_KEY).toBe(FALLBACK_KEY);
    });

    it('sets OPENAI_SMALL_MODEL and OPENAI_LARGE_MODEL to FALLBACK_LLM_MODEL', async () => {
      mockFetchDown();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(process.env.OPENAI_SMALL_MODEL).toBe(FALLBACK_MODEL);
      expect(process.env.OPENAI_LARGE_MODEL).toBe(FALLBACK_MODEL);
    });

    it('treats HTTP 503 as a failure and falls back', async () => {
      mockFetchNon2xx();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.endpoint).toBe('fallback');
    });
  });

  describe('get() — primary recovers after fallback', () => {
    it('switches back to primary and clears fallbackSince', async () => {
      // First call: primary down → switch to fallback
      mockFetchDown();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      // Second call: primary back up → switch back to primary
      mockFetchOk();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.data.endpoint).toBe('primary');
      expect(result.data.fallbackSince).toBeNull();
    });

    it('restores OPENAI_BASE_URL to PRIMARY_LLM_URL on recovery', async () => {
      mockFetchDown();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      mockFetchOk();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(process.env.OPENAI_BASE_URL).toBe(PRIMARY_URL);
    });

    it('does not log a second fallback event when already on fallback', async () => {
      const warnSpy = vi.spyOn(console, 'warn');

      // Call 1: goes down → first fallback warn
      mockFetchDown();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      // Call 2: still down → should NOT emit another warn
      mockFetchDown();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('get() — missing env vars', () => {
    it('returns a "skipped" status text when env vars are absent', async () => {
      clearEnvVars();
      const result = await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(result.text).toContain('skipped');
    });

    it('does not call fetch when env vars are absent', async () => {
      clearEnvVars();
      await llmHealthProvider.get(dummyRuntime, dummyMessage, dummyState);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// checkEndpointHealth unit tests
// ---------------------------------------------------------------------------

describe('checkEndpointHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for a 2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const healthy = await checkEndpointHealth('https://example.com/v1', 3000);
    expect(healthy).toBe(true);
  });

  it('returns false for a non-2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    const healthy = await checkEndpointHealth('https://example.com/v1', 3000);
    expect(healthy).toBe(false);
  });

  it('returns false when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const healthy = await checkEndpointHealth('https://example.com/v1', 3000);
    expect(healthy).toBe(false);
  });

  it('appends /models to the base URL', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    await checkEndpointHealth('https://example.com/v1', 3000);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://example.com/v1/models');
  });

  it('strips trailing slash before appending /models', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    await checkEndpointHealth('https://example.com/v1/', 3000);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://example.com/v1/models');
  });
});
