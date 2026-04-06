import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Thin wrapper around @solana/web3.js Connection.
 * Handles SOL balance retrieval and connection management.
 */
export class SolanaService {
  private readonly connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl);
  }

  /**
   * Returns the raw Connection instance for advanced usage by other services.
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Fetches the SOL balance for the given wallet address.
   * @returns Balance in SOL (not lamports).
   * @throws If the RPC call fails.
   */
  async getSOLBalance(walletAddress: string): Promise<number> {
    const pubkey = new PublicKey(walletAddress);
    const lamports = await this.connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  }
}
