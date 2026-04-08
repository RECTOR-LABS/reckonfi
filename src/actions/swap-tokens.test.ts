import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAgentRuntime } from '@elizaos/core';
import type { SwapQuote } from '../types/index';

// ---------------------------------------------------------------------------
// Mock JupiterService at module level (before SUT import)
// ---------------------------------------------------------------------------

const mockGetQuote = vi.fn();

vi.mock('../services/jupiter.service', () => {
  const JupiterService = vi.fn(function (
    this: { getQuote: typeof mockGetQuote }
  ) {
    this.getQuote = mockGetQuote;
  });
  return { JupiterService };
});

// Import SUT after mocks are registered
import { swapTokensAction, parseSwapIntent } from './swap-tokens';
import {
  createMockRuntime,
  createMockMessage,
  createMockState,
  createMockCallback,
} from '../test/mocks';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const mockQuote: SwapQuote = {
  inputMint: SOL_MINT,
  outputMint: USDC_MINT,
  inputAmount: 1_000_000_000, // 1 SOL in lamports
  outputAmount: 140_000_000,  // 140 USDC in raw units (6 decimals)
  slippage: 0.005,
  route: 'Orca',
  priceImpact: 0.01,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('swapTokensAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- metadata ---

  it('has the correct name', () => {
    expect(swapTokensAction.name).toBe('SWAP_TOKENS');
  });

  it('similes includes SWAP and EXCHANGE', () => {
    expect(swapTokensAction.similes).toContain('SWAP');
    expect(swapTokensAction.similes).toContain('EXCHANGE');
  });

  it('has a non-empty description', () => {
    expect(typeof swapTokensAction.description).toBe('string');
    expect(swapTokensAction.description.length).toBeGreaterThan(0);
  });

  // --- validate ---

  describe('validate()', () => {
    const runtime = {} as IAgentRuntime;

    it('returns true for message containing "swap"', async () => {
      expect(await swapTokensAction.validate(runtime, createMockMessage('swap 1 SOL to USDC'))).toBe(true);
    });

    it('returns true for message containing "convert"', async () => {
      expect(await swapTokensAction.validate(runtime, createMockMessage('convert my SOL to USDC'))).toBe(true);
    });

    it('returns true for message containing "exchange"', async () => {
      expect(await swapTokensAction.validate(runtime, createMockMessage('exchange SOL for USDC'))).toBe(true);
    });

    it('returns true for message containing "trade"', async () => {
      expect(await swapTokensAction.validate(runtime, createMockMessage('trade 2 SOL for USDT'))).toBe(true);
    });

    it('returns true for message containing "move to stable"', async () => {
      expect(await swapTokensAction.validate(runtime, createMockMessage('move to stable coins'))).toBe(true);
    });

    it('returns false for unrelated message', async () => {
      expect(await swapTokensAction.validate(runtime, createMockMessage('what is my portfolio?'))).toBe(false);
    });

    it('is case-insensitive', async () => {
      expect(await swapTokensAction.validate(runtime, createMockMessage('SWAP 1 SOL to USDC'))).toBe(true);
    });
  });

  // --- handler: unparseable intent ---

  describe('handler() — unparseable intent', () => {
    it('calls callback with "I need more details" text and returns success: false', async () => {
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await swapTokensAction.handler(
        runtime,
        createMockMessage('swap some tokens'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: false });
      expect(callback.calls.length).toBeGreaterThan(0);
      expect(callback.calls[0].text).toContain('I need more details');
      expect(mockGetQuote).not.toHaveBeenCalled();
    });
  });

  // --- handler: success ---

  describe('handler() — success', () => {
    it('returns success: true with awaitingConfirmation: true', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await swapTokensAction.handler(
        runtime,
        createMockMessage('swap 1 SOL to USDC'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: true });
      const data = (result as { success: true; data: Record<string, unknown> }).data;
      expect(data.awaitingConfirmation).toBe(true);
    });

    it('data includes fromSymbol, toSymbol, outputAmount, and quote', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await swapTokensAction.handler(
        runtime,
        createMockMessage('swap 1 SOL to USDC'),
        createMockState(),
        {},
        callback,
      );

      const data = (result as { success: true; data: Record<string, unknown> }).data;
      expect(data.fromSymbol).toBe('SOL');
      expect(data.toSymbol).toBe('USDC');
      expect(typeof data.outputAmount).toBe('number');
      expect(data.quote).toEqual(mockQuote);
    });

    it('callback text includes amount, token symbols, and route info', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await swapTokensAction.handler(
        runtime,
        createMockMessage('swap 1 SOL to USDC'),
        createMockState(),
        {},
        callback,
      );

      expect(callback.calls.length).toBeGreaterThan(0);
      const text = callback.calls[0].text as string;
      expect(text).toContain('SOL');
      expect(text).toContain('USDC');
    });

    it('callback text includes confirmation prompt', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await swapTokensAction.handler(
        runtime,
        createMockMessage('swap 1 SOL to USDC'),
        createMockState(),
        {},
        callback,
      );

      const text = callback.calls[0].text as string;
      expect(text.toLowerCase()).toContain('confirm');
      expect(text.toLowerCase()).toContain('cancel');
    });

    it('calls JupiterService.getQuote with correct mints and raw amount', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await swapTokensAction.handler(
        runtime,
        createMockMessage('swap 1 SOL to USDC'),
        createMockState(),
        {},
        callback,
      );

      expect(mockGetQuote).toHaveBeenCalledWith(
        SOL_MINT,
        USDC_MINT,
        1_000_000_000, // 1 SOL * 10^9
        expect.any(Number),
      );
    });
  });

  // --- handler: service error ---

  describe('handler() — service error', () => {
    it('returns { success: false } when JupiterService throws', async () => {
      mockGetQuote.mockRejectedValueOnce(new Error('Jupiter API timeout'));
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      const result = await swapTokensAction.handler(
        runtime,
        createMockMessage('swap 1 SOL to USDC'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: false });
    });

    it('callback receives descriptive error message on failure', async () => {
      mockGetQuote.mockRejectedValueOnce(new Error('Jupiter API timeout'));
      const runtime = createMockRuntime();
      const callback = createMockCallback();

      await swapTokensAction.handler(
        runtime,
        createMockMessage('swap 1 SOL to USDC'),
        createMockState(),
        {},
        callback,
      );

      expect(callback.calls.length).toBeGreaterThan(0);
      expect(callback.calls[0].text).toContain('Jupiter API timeout');
    });
  });
});

// ---------------------------------------------------------------------------
// parseSwapIntent
// ---------------------------------------------------------------------------

describe('parseSwapIntent', () => {
  it('parses "swap 1 SOL to USDC" correctly', () => {
    const result = parseSwapIntent('swap 1 SOL to USDC');
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(1);
    expect(result?.fromSymbol).toBe('SOL');
    expect(result?.toSymbol).toBe('USDC');
    expect(result?.fromMint).toBe(SOL_MINT);
    expect(result?.toMint).toBe(USDC_MINT);
  });

  it('parses decimal amounts like "swap 0.5 SOL for USDT"', () => {
    const result = parseSwapIntent('swap 0.5 SOL for USDT');
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(0.5);
    expect(result?.fromSymbol).toBe('SOL');
    expect(result?.toSymbol).toBe('USDT');
  });

  it('parses "convert 2 USDC into SOL"', () => {
    const result = parseSwapIntent('convert 2 USDC into SOL');
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(2);
    expect(result?.fromSymbol).toBe('USDC');
    expect(result?.toSymbol).toBe('SOL');
  });

  it('returns null for unrecognised token symbols', () => {
    const result = parseSwapIntent('swap 1 XYZ to ABC');
    expect(result).toBeNull();
  });

  it('returns null when pattern does not match', () => {
    const result = parseSwapIntent('swap some tokens');
    expect(result).toBeNull();
  });
});
