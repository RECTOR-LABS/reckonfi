import type { IAgentRuntime } from '@elizaos/core';

/**
 * Gets a setting from ElizaOS runtime, falling back to process.env.
 * ElizaOS getSetting only checks character secrets/settings, not env vars.
 */
export function getSetting(runtime: IAgentRuntime, key: string): string {
  const value = runtime.getSetting(key);
  if (value !== null && value !== undefined && String(value) !== '') {
    return String(value);
  }
  return process.env[key] ?? '';
}
