import type { Position, ProtocolService } from '../types/index';

// ---------------------------------------------------------------------------
// MarginfiService — Phase 1 stub
// ---------------------------------------------------------------------------
//
// Phase 2 integration plan:
//   - Use the official @mrgnlabs/marginfi-client-v2 SDK.
//   - Initialise MarginfiClient with the wallet and Helius RPC connection.
//   - Fetch the MarginfiAccount via client.getMarginfiAccount() to read
//     lending and borrowing balances across all supported asset banks.
//   - Compute healthFactor from the account's maintenance health (mf.health).
//   - Map each bank balance with a positive supply to type='lending' and
//     each positive liability balance to type='borrowing'.
//   - Derive USD values using the bank's oracle price (OraclePrice).
//   - Expose liquidation price from the account's liquidation threshold.
//
// The `apiKey` is retained in the constructor for Phase 2 Helius RPC usage
// (required as the connection endpoint for the MarginFi SDK client).
// ---------------------------------------------------------------------------

/**
 * MarginfiService detects and parses MarginFi lending/borrowing positions.
 *
 * Phase 1: stub — returns empty array.
 * Phase 2: full on-chain integration via @mrgnlabs/marginfi-client-v2.
 */
export class MarginfiService implements ProtocolService {
  // Retained for Phase 2 Helius RPC connection
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Returns all MarginFi positions for `walletAddress`.
   *
   * Phase 1 stub — returns empty array pending Phase 2 SDK integration.
   *
   * @param _walletAddress - Solana wallet public key (base58).
   */
  async getPositions(_walletAddress: string): Promise<Position[]> {
    // Phase 2: integrate @mrgnlabs/marginfi-client-v2 to fetch lending/borrowing positions
    return [];
  }
}
