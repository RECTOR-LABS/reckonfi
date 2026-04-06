import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type { Position } from '../types/index';

// ---------------------------------------------------------------------------
// Mock all three protocol services at module level (before SUT import)
// ---------------------------------------------------------------------------

const mockKaminoGetPositions = vi.fn();
const mockDriftGetPositions = vi.fn();
const mockMarginfiGetPositions = vi.fn();

vi.mock('../services/kamino.service', () => {
  const KaminoService = vi.fn(function (
    this: { getPositions: typeof mockKaminoGetPositions }
  ) {
    this.getPositions = mockKaminoGetPositions;
  });
  return { KaminoService };
});

vi.mock('../services/drift.service', () => {
  const DriftService = vi.fn(function (
    this: { getPositions: typeof mockDriftGetPositions }
  ) {
    this.getPositions = mockDriftGetPositions;
  });
  return { DriftService };
});

vi.mock('../services/marginfi.service', () => {
  const MarginfiService = vi.fn(function (
    this: { getPositions: typeof mockMarginfiGetPositions }
  ) {
    this.getPositions = mockMarginfiGetPositions;
  });
  return { MarginfiService };
});

// Import SUT after mocks are registered
import { positionProvider } from './position-provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

function makeRuntime(
  settings: Record<string, string | undefined> = {}
): IAgentRuntime {
  return {
    getSetting: vi.fn((key: string) => settings[key] ?? null),
  } as unknown as IAgentRuntime;
}

const dummyMessage = {} as Memory;
const dummyState = {} as State;

const kaminoPosition: Position = {
  protocol: 'kamino',
  type: 'lending',
  tokens: [{ mint: 'mint-kusdc', symbol: 'kUSDC', amount: 1000, usdValue: 1000 }],
  value: 1000,
  healthFactor: null,
  liquidationPrice: null,
  pnl: 0,
  apy: 0,
  metadata: { mint: 'mint-kusdc' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('positionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has the correct name and description', () => {
    expect(positionProvider.name).toBe('POSITION_PROVIDER');
    expect(positionProvider.description).toContain('position');
  });

  describe('get()', () => {
    it('returns not-configured message when WALLET_ADDRESS is missing', async () => {
      const runtime = makeRuntime({ HELIUS_API_KEY: 'key-123' });
      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain('not configured');
      expect(mockKaminoGetPositions).not.toHaveBeenCalled();
    });

    it('returns not-configured message when HELIUS_API_KEY is missing', async () => {
      const runtime = makeRuntime({ WALLET_ADDRESS: WALLET });
      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain('not configured');
      expect(mockKaminoGetPositions).not.toHaveBeenCalled();
    });

    it('aggregates positions from all three protocols in parallel', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(mockKaminoGetPositions).toHaveBeenCalledWith(WALLET);
      expect(mockDriftGetPositions).toHaveBeenCalledWith(WALLET);
      expect(mockMarginfiGetPositions).toHaveBeenCalledWith(WALLET);

      expect(result.data.positions).toHaveLength(1);
    });

    it('text contains "kamino" when a Kamino position is returned', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text.toLowerCase()).toContain('kamino');
    });

    it('data.positions has exactly 1 entry when only Kamino returns a position', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.data.positions).toHaveLength(1);
      expect(result.data.positions[0].protocol).toBe('kamino');
    });

    it('data.totalValue reflects the sum of all position values', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.data.totalValue).toBeCloseTo(1000, 2);
    });

    it('text contains total value', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain('1000');
    });

    it('returns "No open positions" text when all protocols return empty arrays', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text.toLowerCase()).toContain('no open positions');
      expect(result.data.positions).toHaveLength(0);
      expect(result.data.totalValue).toBe(0);
    });

    it('collects fulfilled positions and tracks errors from rejected promises', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([kaminoPosition]);
      mockDriftGetPositions.mockRejectedValueOnce(new Error('Drift RPC timeout'));
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      // Still returns the Kamino position despite Drift failure
      expect(result.data.positions).toHaveLength(1);
      // Errors tracked
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]).toContain('Drift RPC timeout');
    });

    it('includes health factor in text when position has a non-null healthFactor', async () => {
      const posWithHealth: Position = {
        ...kaminoPosition,
        healthFactor: 1.85,
      };
      mockKaminoGetPositions.mockResolvedValueOnce([posWithHealth]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      const result = await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(result.text).toContain('1.85');
    });

    it('calls all three services with the wallet address', async () => {
      mockKaminoGetPositions.mockResolvedValueOnce([]);
      mockDriftGetPositions.mockResolvedValueOnce([]);
      mockMarginfiGetPositions.mockResolvedValueOnce([]);

      const runtime = makeRuntime({
        WALLET_ADDRESS: WALLET,
        HELIUS_API_KEY: 'key-123',
      });

      await positionProvider.get(runtime, dummyMessage, dummyState);

      expect(mockKaminoGetPositions).toHaveBeenCalledWith(WALLET);
      expect(mockDriftGetPositions).toHaveBeenCalledWith(WALLET);
      expect(mockMarginfiGetPositions).toHaveBeenCalledWith(WALLET);
    });
  });
});
