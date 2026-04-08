/**
 * StatusBar — bottom bar showing portfolio health score, trend, and volatility.
 * Features a ring/gauge visual for health score.
 */

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketTrend = 'Bullish' | 'Bearish' | 'Neutral';
export type VolatilityLevel = 'Low' | 'Medium' | 'High';

interface StatusBarProps {
  healthScore: number;       // 0–100
  trend: MarketTrend;
  volatility: VolatilityLevel;
}

// ─── Health Ring ──────────────────────────────────────────────────────────────

interface HealthRingProps {
  score: number; // 0–100
}

function HealthRing({ score }: HealthRingProps) {
  // SVG circle gauge — circumference math for a small ring
  const r = 10;
  const cx = 14;
  const cy = 14;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const gap = circumference - filled;

  // Gradient stop based on score
  const strokeColor =
    score > 70
      ? '#22c55e'  // green-500
      : score > 40
      ? '#eab308'  // yellow-500
      : '#ef4444'; // red-500

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      className="-rotate-90"
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth="3"
        className="stroke-muted"
      />
      {/* Progress arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth="3"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthBarGradient(score: number): string {
  if (score > 70) return 'from-green-500 to-emerald-400';
  if (score > 40) return 'from-yellow-500 to-amber-400';
  return 'from-red-500 to-rose-400';
}

function healthScoreColor(score: number): string {
  if (score > 70) return 'text-green-500 dark:text-green-400';
  if (score > 40) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-red-500 dark:text-red-400';
}

function trendConfig(trend: MarketTrend): { color: string; Icon: typeof TrendingUp } {
  switch (trend) {
    case 'Bullish':
      return { color: 'text-green-600 dark:text-green-400', Icon: TrendingUp };
    case 'Bearish':
      return { color: 'text-red-600 dark:text-red-400', Icon: TrendingDown };
    case 'Neutral':
      return { color: 'text-muted-foreground', Icon: Minus };
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
  const score = Math.max(0, Math.min(100, healthScore));
  const barGradient = healthBarGradient(score);
  const scoreColor = healthScoreColor(score);
  const { color: trendColor, Icon: TrendIcon } = trendConfig(trend);

  return (
    <div className="border-t px-4 py-2.5 flex items-center gap-5 text-xs bg-background">
      {/* Health score — ring + bar combo */}
      <div
        className="flex items-center gap-2"
        role="status"
        aria-label={`Portfolio health: ${score} out of 100`}
      >
        {/* Mini ring gauge */}
        <div className="relative flex items-center justify-center">
          <HealthRing score={score} />
          {/* Score label inside ring */}
          <span
            className={cn(
              'absolute text-[8px] font-bold tabular-nums leading-none',
              scoreColor
            )}
          >
            {score}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-medium leading-none">Health Score</span>
          {/* Wider gradient progress bar */}
          <div
            className="relative h-2 w-32 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out',
                barGradient
              )}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        <span className={cn('font-bold tabular-nums text-sm', scoreColor)}>
          {score}
          <span className="text-muted-foreground font-normal text-xs">/100</span>
        </span>
      </div>

      {/* Separator */}
      <span className="text-border select-none h-5 w-px bg-border" aria-hidden="true" />

      {/* Market trend */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-medium">Market:</span>
        <span className={cn('flex items-center gap-1 font-semibold', trendColor)}>
          <TrendIcon className="size-3" aria-hidden="true" />
          {trend}
        </span>
      </div>

      {/* Separator */}
      <span className="text-border select-none h-5 w-px bg-border" aria-hidden="true" />

      {/* Volatility */}
      <div className="flex items-center gap-1.5">
        <Activity className="size-3 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground font-medium">Volatility:</span>
        <span className={cn('font-semibold', volatilityColor(volatility))}>
          {volatility}
        </span>
      </div>
    </div>
  );
}
