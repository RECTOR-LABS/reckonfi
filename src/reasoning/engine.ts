import type {
  PortfolioSnapshot,
  ReasoningResult,
  Risk,
  Confidence,
} from '../types/index';
import {
  portfolioHealthScore,
  liquidationDistance,
  concentrationRisk,
} from './risk-calculator';

// ---------------------------------------------------------------------------
// Severity ordering for sorting
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<Risk['severity'], number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

// ---------------------------------------------------------------------------
// Risk checks
// ---------------------------------------------------------------------------

/**
 * Check portfolio for concentration risk using HHI.
 *
 * HHI > 0.5 → high risk
 * HHI > 0.25 → medium risk
 */
function checkConcentrationRisk(snapshot: PortfolioSnapshot): Risk[] {
  const risks: Risk[] = [];
  const hhi = concentrationRisk(snapshot.exposure.byToken);

  if (hhi > 0.5) {
    risks.push({
      severity: 'high',
      description: `High concentration risk: portfolio HHI is ${hhi.toFixed(3)}. Single-token dominance exposes the portfolio to outsized drawdown.`,
      position: null,
    });
  } else if (hhi > 0.25) {
    risks.push({
      severity: 'medium',
      description: `Moderate concentration risk: portfolio HHI is ${hhi.toFixed(3)}. Consider diversifying token exposure.`,
      position: null,
    });
  }

  return risks;
}

/**
 * Check each position for proximity to liquidation.
 *
 * distance < 5%  (hf < ~1.05) → critical
 * distance < 10% (hf < ~1.11) → high
 * distance < 25% (hf < ~1.33) → medium
 */
function checkLiquidationRisk(snapshot: PortfolioSnapshot): Risk[] {
  const risks: Risk[] = [];

  for (const position of snapshot.positions) {
    const distance = liquidationDistance(position);
    if (distance === null) continue;

    if (distance < 5) {
      risks.push({
        severity: 'critical',
        description: `Position critically close to liquidation (${distance.toFixed(1)}% drop triggers liquidation). Immediate action required.`,
        position,
      });
    } else if (distance < 10) {
      risks.push({
        severity: 'high',
        description: `Position at high liquidation risk (${distance.toFixed(1)}% drop triggers liquidation). Consider reducing exposure.`,
        position,
      });
    } else if (distance < 25) {
      risks.push({
        severity: 'medium',
        description: `Position approaching liquidation threshold (${distance.toFixed(1)}% drop triggers liquidation). Monitor closely.`,
        position,
      });
    }
  }

  return risks;
}

/**
 * Check portfolio leverage ratio.
 *
 * ratio > 0.7 → high risk
 * ratio > 0.4 → medium risk
 */
function checkLeverageRisk(snapshot: PortfolioSnapshot): Risk[] {
  const risks: Risk[] = [];
  const { leverageRatio } = snapshot.exposure;

  if (leverageRatio > 0.7) {
    risks.push({
      severity: 'high',
      description: `High leverage ratio of ${leverageRatio.toFixed(2)}. Borrowings represent more than 70% of deposit value, amplifying downside risk.`,
      position: null,
    });
  }

  return risks;
}

/**
 * Check for volatile market conditions combined with leveraged positions.
 * Only flags a risk when there is active borrowing/perp exposure.
 */
function checkMarketVolatilityRisk(snapshot: PortfolioSnapshot): Risk[] {
  const risks: Risk[] = [];
  const { volatility, trend } = snapshot.market;

  if (volatility !== 'high' && volatility !== 'extreme') return risks;

  // Only flag if the portfolio carries leveraged or short exposure
  const hasLeveragedPositions = snapshot.positions.some(
    (p) => p.type === 'borrowing' || p.type === 'perp-long' || p.type === 'perp-short',
  );

  if (!hasLeveragedPositions) return risks;

  const severity: Risk['severity'] = volatility === 'extreme' ? 'high' : 'medium';
  const trendNote =
    trend === 'bearish'
      ? ' Market is trending bearish — consider reducing risk exposure.'
      : '';

  risks.push({
    severity,
    description: `${volatility.charAt(0).toUpperCase() + volatility.slice(1)} market volatility detected while holding leveraged positions.${trendNote}`,
    position: null,
  });

  return risks;
}

// ---------------------------------------------------------------------------
// Recommendation generator
// ---------------------------------------------------------------------------

function buildRecommendation(
  topSeverity: Risk['severity'] | null,
  healthScore: number,
): ReasoningResult['recommendation'] {
  if (topSeverity === 'critical') {
    return {
      action: 'Reduce exposure immediately',
      reasoning:
        'One or more positions are critically close to liquidation. Repay debt or add collateral to avoid forced liquidation.',
      confidence: 'high',
    };
  }

  if (topSeverity === 'high') {
    return {
      action: 'Reduce risk',
      reasoning:
        'High severity risks detected. De-lever, diversify, or hedge to protect the portfolio.',
      confidence: 'high',
    };
  }

  if (topSeverity === 'medium') {
    return {
      action: 'Monitor and rebalance',
      reasoning:
        'Medium severity risks present. No immediate action required, but review positions and consider rebalancing.',
      confidence: 'medium',
    };
  }

  return {
    action: 'Hold steady',
    reasoning: `Portfolio health score is ${healthScore}/100 with no significant risks detected. Continue current strategy.`,
    confidence: 'high',
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyze a portfolio snapshot and return risks, recommendation, and analysis.
 *
 * Risk checks performed:
 *   1. Concentration risk (HHI)
 *   2. Liquidation proximity
 *   3. Leverage ratio
 *   4. Market volatility × leveraged positions
 */
export function analyzePortfolio(snapshot: PortfolioSnapshot): ReasoningResult {
  // Collect all risks
  const risks: Risk[] = [
    ...checkConcentrationRisk(snapshot),
    ...checkLiquidationRisk(snapshot),
    ...checkLeverageRisk(snapshot),
    ...checkMarketVolatilityRisk(snapshot),
  ];

  // Sort by descending severity
  risks.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  // Health score
  const healthScore = portfolioHealthScore(snapshot.positions);

  // Top severity for recommendation
  const topSeverity: Risk['severity'] | null = risks.length > 0 ? risks[0].severity : null;
  const recommendation = buildRecommendation(topSeverity, healthScore);

  // Build analysis text
  const { totalUSD } = snapshot.wallet;
  const { volatility, trend } = snapshot.market;
  const formattedValue = totalUSD.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });

  const riskSummary =
    risks.length === 0
      ? 'No significant risks detected.'
      : `${risks.length} risk${risks.length > 1 ? 's' : ''} identified (top severity: ${topSeverity}).`;

  const analysis = [
    `Portfolio value: $${formattedValue} | Health score: ${healthScore}/100`,
    `Market: volatility=${volatility}, trend=${trend}`,
    riskSummary,
    `Recommendation: ${recommendation.action}`,
  ].join(' | ');

  return {
    analysis,
    risks,
    recommendation,
  };
}
