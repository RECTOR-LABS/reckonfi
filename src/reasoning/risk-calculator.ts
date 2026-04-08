import type { Position } from '../types/index';

/**
 * Compute a 0-100 portfolio health score weighted by position value.
 *
 * Score formula per position (with healthFactor):
 *   score = clamp(0, 100, ((hf - 1.0) / 1.25) * 100)
 *
 * This satisfies the canonical spec mappings:
 *   hf=1.0 → 0, hf=2.0 → 80, hf≥3.0 → 100
 *
 * The final score is the value-weighted average across positions that have
 * a non-null healthFactor. Positions with null healthFactor are excluded
 * from the weighted average entirely (not counted as 0).
 *
 * Edge cases:
 *   - No positions, or all positions have null healthFactor → 100
 *   - Total eligible value is 0 → 100
 */
export function portfolioHealthScore(positions: Position[]): number {
  if (positions.length === 0) return 100;

  // Only consider positions that carry a health factor
  const eligible = positions.filter((p) => p.healthFactor !== null);
  if (eligible.length === 0) return 100;

  const totalValue = eligible.reduce((sum, p) => sum + p.value, 0);
  if (totalValue === 0) return 100;

  const weightedScore = eligible.reduce((sum, p) => {
    const hf = p.healthFactor as number;
    const score = Math.min(100, Math.max(0, ((hf - 1.0) / 1.25) * 100));
    const weight = p.value / totalValue;
    return sum + score * weight;
  }, 0);

  return Math.round(weightedScore);
}

/**
 * Compute the percentage price drop required to trigger liquidation for a
 * single position.
 *
 * Formula: ((hf - 1.0) / hf) * 100
 *
 * Returns:
 *   - null  → position has no health factor
 *   - 0     → already at or past liquidation (hf ≤ 1.0)
 *   - [0, 100) → percent drop to reach liquidation threshold
 */
export function liquidationDistance(position: Position): number | null {
  if (position.healthFactor === null) return null;

  const hf = position.healthFactor;
  if (hf <= 1.0) return 0;

  return ((hf - 1.0) / hf) * 100;
}

/**
 * Compute the Herfindahl-Hirschman Index (HHI) for token concentration.
 *
 * HHI = Σ (share_i)^2  where share_i = value_i / totalValue
 *
 * Range: [1/n, 1.0]
 *   - 1.0 → single token holds 100% (maximum concentration)
 *   - 1/n → n tokens at equal weight (maximum diversification for n tokens)
 *
 * Returns 0 for an empty map (no exposure data).
 */
export function concentrationRisk(exposureByToken: Map<string, number>): number {
  if (exposureByToken.size === 0) return 0;

  const values = Array.from(exposureByToken.values());
  const total = values.reduce((sum, v) => sum + v, 0);

  if (total === 0) return 0;

  return values.reduce((sum, v) => {
    const share = v / total;
    return sum + share * share;
  }, 0);
}
