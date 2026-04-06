import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolanaService } from './solana.service';

// ---------------------------------------------------------------------------
// Mock @solana/web3.js — intercept Connection construction and method calls
// ---------------------------------------------------------------------------

const mockGetBalance = vi.fn();

vi.mock('@solana/web3.js', () => {
  // Connection must be a real class so `new Connection(...)` works
  class MockConnection {
    getBalance = mockGetBalance;
  }

  class MockPublicKey {
    private address: string;
    constructor(address: string) {
      this.address = address;
    }
    toBase58() {
      return this.address;
    }
  }

  return {
    Connection: MockConnection,
    PublicKey: MockPublicKey,
    LAMPORTS_PER_SOL: 1_000_000_000,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SolanaService', () => {
  const RPC_URL = 'https://api.devnet.solana.com';
  const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates a service instance without throwing', () => {
      expect(() => new SolanaService(RPC_URL)).not.toThrow();
    });
  });

  describe('getConnection()', () => {
    it('returns the internal Connection instance', () => {
      const service = new SolanaService(RPC_URL);
      const conn = service.getConnection();
      expect(conn).toBeDefined();
      // Verify the returned connection has the expected interface
      expect(typeof conn.getBalance).toBe('function');
    });
  });

  describe('getSOLBalance()', () => {
    it('converts lamports to SOL correctly', async () => {
      // 2.5 SOL = 2_500_000_000 lamports
      mockGetBalance.mockResolvedValueOnce(2_500_000_000);

      const service = new SolanaService(RPC_URL);
      const balance = await service.getSOLBalance(WALLET);

      expect(balance).toBe(2.5);
      expect(mockGetBalance).toHaveBeenCalledTimes(1);
    });

    it('returns 0 when balance is 0 lamports', async () => {
      mockGetBalance.mockResolvedValueOnce(0);

      const service = new SolanaService(RPC_URL);
      const balance = await service.getSOLBalance(WALLET);

      expect(balance).toBe(0);
    });

    it('handles fractional SOL amounts correctly', async () => {
      // 0.001 SOL = 1_000_000 lamports
      mockGetBalance.mockResolvedValueOnce(1_000_000);

      const service = new SolanaService(RPC_URL);
      const balance = await service.getSOLBalance(WALLET);

      expect(balance).toBeCloseTo(0.001, 6);
    });

    it('propagates RPC errors', async () => {
      mockGetBalance.mockRejectedValueOnce(new Error('RPC connection failed'));

      const service = new SolanaService(RPC_URL);
      await expect(service.getSOLBalance(WALLET)).rejects.toThrow('RPC connection failed');
    });
  });
});
