import { getSetting } from '../utils/get-setting';
import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { KaminoService } from '../services/kamino.service';
import { DriftService } from '../services/drift.service';
import { MarginfiService } from '../services/marginfi.service';
import { getWalletOverride } from '../actions/set-wallet';
import type { Position } from '../types/index';

// ---------------------------------------------------------------------------
// positionProvider
// ---------------------------------------------------------------------------

/**
 * ElizaOS provider that aggregates DeFi positions across Kamino, Drift, and
 * MarginFi using Promise.allSettled for fault-tolerant parallel fetching.
 *
 * Phase 1: Kamino returns live lending positions; Drift and MarginFi are stubs.
 * Phase 2: All three services will return fully hydrated positions.
 */
export const positionProvider: Provider = {
  name: 'POSITION_PROVIDER',
  description: 'Provides DeFi positions across Kamino, Drift, and Marginfi',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<{
    text: string;
    data: { positions: Position[]; totalValue: number; errors: string[] };
  }> => {
    const walletAddress = getWalletOverride() || getSetting(runtime, 'WALLET_ADDRESS');
    const heliusApiKey = getSetting(runtime, 'HELIUS_API_KEY');

    if (!walletAddress || !heliusApiKey) {
      return {
        text: 'Position provider not configured. Set WALLET_ADDRESS and HELIUS_API_KEY.',
        data: { positions: [], totalValue: 0, errors: [] },
      };
    }

    const kamino = new KaminoService(heliusApiKey);
    const drift = new DriftService(heliusApiKey);
    const marginfi = new MarginfiService(heliusApiKey);

    // Fetch all three protocols in parallel; tolerate individual failures
    const [kaminoResult, driftResult, marginfiResult] = await Promise.allSettled([
      kamino.getPositions(walletAddress),
      drift.getPositions(walletAddress),
      marginfi.getPositions(walletAddress),
    ]);

    const positions: Position[] = [];
    const errors: string[] = [];

    for (const result of [kaminoResult, driftResult, marginfiResult]) {
      if (result.status === 'fulfilled') {
        positions.push(...result.value);
      } else {
        const msg =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errors.push(msg);
      }
    }

    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);

    // Build human-readable text
    const lines: string[] = [`DeFi Positions — Total Value: $${totalValue.toFixed(2)}`];

    if (positions.length === 0) {
      lines.push('No open positions across Kamino, Drift, and MarginFi.');
    } else {
      for (const pos of positions) {
        const healthStr =
          pos.healthFactor !== null ? ` | Health: ${pos.healthFactor.toFixed(2)}` : '';
        lines.push(
          `  [${pos.protocol}] ${pos.type} — $${pos.value.toFixed(2)}${healthStr}`
        );
      }
    }

    if (errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      for (const err of errors) {
        lines.push(`  - ${err}`);
      }
    }

    return {
      text: lines.join('\n'),
      data: { positions, totalValue, errors },
    };
  },
};
