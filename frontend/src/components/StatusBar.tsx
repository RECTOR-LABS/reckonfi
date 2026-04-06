/**
 * StatusBar — bottom bar showing portfolio health score, trend, and volatility.
 */

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketTrend = 'Bullish' | 'Bearish' | 'Neutral';
export type VolatilityLevel = 'Low' | 'Medium' | 'High';

interface StatusBarProps {
  healthScore: number;       // 0–100
  trend: MarketTrend;
  volatility: VolatilityLevel;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthBarColor(score: number): string {
  if (score > 70) return 'bg-green-500';
  if (score > 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function trendColor(trend: MarketTrend): string {
  switch (trend) {
    case 'Bullish': return 'text-green-600 dark:text-green-400';
    case 'Bearish': return 'text-red-600 dark:text-red-400';
    case 'Neutral': return 'text-muted-foreground';
  }
}

function volatilityColor(level: VolatilityLevel): string {
  switch (level) {
    case 'Low':    return 'text-green-600 dark:text-green-400';
    case 'Medium': return 'text-yellow-600 dark:text-yellow-400';
    case 'High':   return 'text-red-600 dark:text-red-400';
  }
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

export function StatusBar({ healthScore, trend, volatility }: StatusBarProps) {
  const clampedScore = Math.max(0, Math.min(100, healthScore));
  const barColor = healthBarColor(clampedScore);

  return (
    <div className="border-t px-4 py-2 flex items-center gap-6 text-xs bg-background">
      {/* Health score */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-medium whitespace-nowrap">Health:</span>
        <div
          className="relative h-2 w-24 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={clampedScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Portfolio health: ${clampedScore} out of 100`}
        >
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${clampedScore}%` }}
          />
        </div>
        <span className="tabular-nums text-foreground font-semibold">
          {clampedScore}<span className="text-muted-foreground font-normal">/100</span>
        </span>
      </div>

      {/* Separator */}
      <span className="text-border select-none">|</span>

      {/* Market trend */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium">Market:</span>
        <span className={cn('font-semibold', trendColor(trend))}>{trend}</span>
      </div>

      {/* Separator */}
      <span className="text-border select-none">|</span>

      {/* Volatility */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium">Volatility:</span>
        <span className={cn('font-semibold', volatilityColor(volatility))}>{volatility}</span>
      </div>
    </div>
  );
}
