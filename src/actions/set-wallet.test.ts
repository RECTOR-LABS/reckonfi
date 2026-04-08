import { describe, it, expect, beforeEach } from 'vitest';
import type { IAgentRuntime } from '@elizaos/core';

import {
  setWalletAction,
  getWalletOverride,
  setWalletOverride,
} from './set-wallet';
import {
  createMockMessage,
  createMockState,
  createMockCallback,
  createMockRuntime,
} from '../test/mocks';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WALLET_A = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';
const WALLET_B = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

// ---------------------------------------------------------------------------
// Reset module-level override between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear override state so tests are isolated
  setWalletOverride('');
});

// ---------------------------------------------------------------------------
// Action metadata
// ---------------------------------------------------------------------------

describe('setWalletAction metadata', () => {
  it('has the correct name', () => {
    expect(setWalletAction.name).toBe('SET_WALLET');
  });

  it('includes all expected similes', () => {
    expect(setWalletAction.similes).toContain('USE_WALLET');
    expect(setWalletAction.similes).toContain('SWITCH_WALLET');
    expect(setWalletAction.similes).toContain('MONITOR_WALLET');
    expect(setWalletAction.similes).toContain('WALLET_ADDRESS');
  });

  it('has a non-empty description', () => {
    expect(typeof setWalletAction.description).toBe('string');
    expect(setWalletAction.description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe('setWalletAction.validate()', () => {
  const runtime = {} as IAgentRuntime;

  it('returns true for "use wallet <address>"', async () => {
    const msg = createMockMessage(`use wallet ${WALLET_A}`);
    expect(await setWalletAction.validate(runtime, msg)).toBe(true);
  });

  it('returns true for "set wallet <address>"', async () => {
    const msg = createMockMessage(`set wallet ${WALLET_A}`);
    expect(await setWalletAction.validate(runtime, msg)).toBe(true);
  });

  it('returns true for "switch wallet to <address>"', async () => {
    const msg = createMockMessage(`switch wallet to ${WALLET_B}`);
    expect(await setWalletAction.validate(runtime, msg)).toBe(true);
  });

  it('returns true for "monitor wallet <address>"', async () => {
    const msg = createMockMessage(`monitor wallet ${WALLET_A}`);
    expect(await setWalletAction.validate(runtime, msg)).toBe(true);
  });

  it('returns true when message contains a bare Solana address', async () => {
    const msg = createMockMessage(WALLET_A);
    expect(await setWalletAction.validate(runtime, msg)).toBe(true);
  });

  it('is case-insensitive for keyword matching', async () => {
    const msg = createMockMessage(`USE WALLET ${WALLET_A}`);
    expect(await setWalletAction.validate(runtime, msg)).toBe(true);
  });

  it('returns false for unrelated message without Solana address', async () => {
    const msg = createMockMessage('what is the price of SOL?');
    expect(await setWalletAction.validate(runtime, msg)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handler() — success
// ---------------------------------------------------------------------------

describe('setWalletAction.handler() — success', () => {
  it('extracts wallet address from "use wallet <address>" message', async () => {
    const runtime = createMockRuntime();
    const callback = createMockCallback();
    const msg = createMockMessage(`use wallet ${WALLET_A}`);

    const result = await setWalletAction.handler(
      runtime,
      msg,
      createMockState(),
      {},
      callback,
    );

    expect(result).toMatchObject({ success: true });
    expect(
      (result as { success: true; data: { walletAddress: string } }).data.walletAddress,
    ).toBe(WALLET_A);
  });

  it('extracts wallet address from a message with a bare address', async () => {
    const runtime = createMockRuntime();
    const callback = createMockCallback();
    const msg = createMockMessage(`Switch to ${WALLET_B} please`);

    const result = await setWalletAction.handler(
      runtime,
      msg,
      createMockState(),
      {},
      callback,
    );

    expect(result).toMatchObject({ success: true });
    expect(
      (result as { success: true; data: { walletAddress: string } }).data.walletAddress,
    ).toBe(WALLET_B);
  });

  it('callback confirms the new wallet address', async () => {
    const runtime = createMockRuntime();
    const callback = createMockCallback();
    const msg = createMockMessage(`use wallet ${WALLET_A}`);

    await setWalletAction.handler(runtime, msg, createMockState(), {}, callback);

    expect(callback.calls.length).toBe(1);
    expect(callback.calls[0].text).toContain(WALLET_A);
    expect(callback.calls[0].text).toContain('Now monitoring wallet');
  });

  it('persists address in module-level override', async () => {
    const runtime = createMockRuntime();
    const msg = createMockMessage(`use wallet ${WALLET_A}`);

    await setWalletAction.handler(runtime, msg, createMockState(), {});

    expect(getWalletOverride()).toBe(WALLET_A);
  });
});

// ---------------------------------------------------------------------------
// handler() — no address provided
// ---------------------------------------------------------------------------

describe('setWalletAction.handler() — no address', () => {
  it('returns { success: false } when no address is found', async () => {
    const runtime = createMockRuntime();
    const callback = createMockCallback();
    const msg = createMockMessage('set wallet please');

    const result = await setWalletAction.handler(
      runtime,
      msg,
      createMockState(),
      {},
      callback,
    );

    expect(result).toMatchObject({ success: false });
  });

  it('callback includes instructional text when no address is provided', async () => {
    const runtime = createMockRuntime();
    const callback = createMockCallback();
    const msg = createMockMessage('use wallet');

    await setWalletAction.handler(runtime, msg, createMockState(), {}, callback);

    expect(callback.calls.length).toBe(1);
    expect(callback.calls[0].text).toContain('Please provide a Solana wallet address');
  });

  it('does not mutate the wallet override on failure', async () => {
    setWalletOverride(WALLET_A);
    const runtime = createMockRuntime();
    const msg = createMockMessage('use wallet');

    await setWalletAction.handler(runtime, msg, createMockState(), {});

    // Override should remain unchanged
    expect(getWalletOverride()).toBe(WALLET_A);
  });
});

// ---------------------------------------------------------------------------
// getWalletOverride / setWalletOverride
// ---------------------------------------------------------------------------

describe('getWalletOverride / setWalletOverride', () => {
  it('returns null when no override has been set (empty string treated as falsy)', () => {
    // beforeEach sets it to '' — the override getter returns '' which is falsy
    const val = getWalletOverride();
    expect(val === null || val === '').toBe(true);
  });

  it('returns the address after setWalletOverride is called', () => {
    setWalletOverride(WALLET_A);
    expect(getWalletOverride()).toBe(WALLET_A);
  });

  it('updates to a new address on subsequent calls', () => {
    setWalletOverride(WALLET_A);
    setWalletOverride(WALLET_B);
    expect(getWalletOverride()).toBe(WALLET_B);
  });
});
