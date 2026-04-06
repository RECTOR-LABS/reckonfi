import type { Position, ProtocolService } from '../types/index';

// ---------------------------------------------------------------------------
// DriftService — Phase 1 stub
// ---------------------------------------------------------------------------
//
// Phase 2 integration plan:
//   - Use the official @drift-protocol/sdk to connect to the Drift program.
//   - Fetch user accounts via DriftClient.getUserAccountPublicKey() and
//     DriftClient.getUser() to read perpetual and spot positions.
//   - Parse PerpPosition[] and SpotPosition[] into Position objects with
//     accurate PnL, health factor, leverage, and liquidation price.
//   - Map perp longs/shorts to PositionType 'perp-long' / 'perp-short'.
//   - Map spot borrows to 'borrowing' and deposits to 'lending'.
//   - Derive APY from market funding rates for perp positions.
//
// The `apiKey` is retained in the constructor for Phase 2 Helius RPC usage
// (required for Drift program account subscriptions via WebSocket RPC).
// ---------------------------------------------------------------------------

/**
 * DriftService detects and parses Drift Protocol positions.
 *
 * Phase 1: stub — returns empty array.
 * Phase 2: full on-chain integration via @drift-protocol/sdk.
 */
export class DriftService implements ProtocolService {
  // Retained for Phase 2 Helius WebSocket RPC subscriptions
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Returns all Drift positions for `walletAddress`.
   *
   * Phase 1 stub — returns empty array pending Phase 2 SDK integration.
   *
   * @param _walletAddress - Solana wallet public key (base58).
   */
  async getPositions(_walletAddress: string): Promise<Position[]> {
    // Phase 2: integrate @drift-protocol/sdk to fetch perp + spot positions
    return [];
  }
}
