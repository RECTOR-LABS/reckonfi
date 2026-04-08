/**
 * PortfolioPanel — displays wallet token balances fetched via Helius DAS.
 * Polls every 30s via TanStack Query refetchInterval.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { fetchWalletBalances, type TokenBalance } from '@/lib/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAmount(amount: number): string {
  if (amount === 0) return '0';
  if (amount < 0.001) return amount.toExponential(2);
  if (amount < 1) return amount.toFixed(4);
  if (amount < 1000) return amount.toFixed(2);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

function formatTimeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// Returns a deterministic accent color for a token index in the allocation bar
const ALLOC_COLORS = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#a78bfa', // light violet
  '#34d399', // light emerald
  '#60a5fa', // light blue
];

function allocationColor(index: number): string {
  return ALLOC_COLORS[index % ALLOC_COLORS.length];
}

// Badge variant per allocation percentage
function pctBadgeClass(pct: number): string {
  if (pct > 50) return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (pct > 25) return 'border-blue-500/30 bg-blue-500/8 text-blue-600 dark:text-blue-400';
  return '';
}

// ─── Allocation Bar ───────────────────────────────────────────────────────────

interface AllocationBarProps {
  tokens: TokenBalance[];
  totalUSD: number;
}

function AllocationBar({ tokens, totalUSD }: AllocationBarProps) {
  if (totalUSD === 0 || tokens.length === 0) return null;

  return (
    <div className="mt-2 mb-1">
      <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
        {tokens.map((token, i) => {
          const pct = token.valueUSD != null ? (token.valueUSD / totalUSD) * 100 : 0;
          if (pct < 0.5) return null;
          return (
            <div
              key={token.mint}
              title={`${token.symbol}: ${pct.toFixed(1)}%`}
              className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${pct}%`,
                backgroundColor: allocationColor(i),
                opacity: 0.9,
              }}
            />
          );
        })}
      </div>
      {/* Legend: top 3 tokens */}
      <div className="flex gap-3 mt-1.5 flex-wrap">
        {tokens.slice(0, 4).map((token, i) => {
          const pct = token.valueUSD != null ? (token.valueUSD / totalUSD) * 100 : 0;
          if (pct < 1) return null;
          return (
            <div key={token.mint} className="flex items-center gap-1">
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ backgroundColor: allocationColor(i) }}
                aria-hidden="true"
              />
              <span className="text-[10px] text-muted-foreground">
                {token.symbol} {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Token Row ────────────────────────────────────────────────────────────────

interface TokenRowProps {
  token: TokenBalance;
  percentage: number;
  colorIndex: number;
  animate: boolean;
}

function TokenRow({ token, percentage, colorIndex, animate }: TokenRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 py-2 transition-opacity duration-500',
        animate ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Color dot accent matching allocation bar */}
        <span
          className="size-1.5 rounded-full shrink-0"
          style={{ backgroundColor: allocationColor(colorIndex) }}
          aria-hidden="true"
        />
        {token.logoURI ? (
          <img
            src={token.logoURI}
            alt={token.symbol}
            className="size-6 rounded-full shrink-0 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="size-6 rounded-full bg-muted shrink-0 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
            {token.symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium leading-none truncate">{token.symbol}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {formatAmount(token.uiAmount)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-medium">
          {token.valueUSD != null ? formatUSD(token.valueUSD) : '—'}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] tabular-nums w-12 justify-center',
            pctBadgeClass(percentage)
          )}
        >
          {percentage.toFixed(1)}%
        </Badge>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2 animate-pulse">
          <div className="size-6 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-2.5 w-10 rounded bg-muted" />
          </div>
          <div className="h-3 w-14 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ─── PortfolioPanel ───────────────────────────────────────────────────────────

export function PortfolioPanel() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['walletBalances'],
    queryFn: fetchWalletBalances,
    refetchInterval: 30_000,
  });

  // Fade-in animation: reset on each new data fetch
  const [animateRows, setAnimateRows] = useState(false);
  const prevUpdatedAt = useRef(0);

  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== prevUpdatedAt.current) {
      prevUpdatedAt.current = dataUpdatedAt;
      setAnimateRows(false);
      // Tiny delay so browser registers the opacity-0 before transitioning
      const id = requestAnimationFrame(() => setAnimateRows(true));
      return () => cancelAnimationFrame(id);
    }
  }, [dataUpdatedAt]);

  // Live "X ago" counter
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const updatedDate = new Date(dataUpdatedAt);
    const tick = () => setLastUpdatedLabel(formatTimeAgo(updatedDate));
    tick();
    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const top10 = data?.tokens.slice(0, 10) ?? [];
  const totalUSD = data?.totalUSD ?? 0;

  return (
    <Card className="rounded-none border-0 ring-0 flex-1 min-h-0 flex flex-col">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Portfolio
          </CardTitle>
          {lastUpdatedLabel && (
            <span className="text-[10px] text-muted-foreground">
              Updated {lastUpdatedLabel}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="h-8 w-32 rounded bg-muted animate-pulse mt-1" />
        )}
        {!isLoading && isError && (
          <p className="text-xs text-destructive mt-1">
            {error instanceof Error ? error.message : 'Failed to load balances'}
          </p>
        )}
        {!isLoading && !isError && (
          <>
            <p className="text-2xl font-bold tracking-tight mt-1">{formatUSD(totalUSD)}</p>
            <AllocationBar tokens={top10} totalUSD={totalUSD} />
          </>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-4">
          {isLoading && <SkeletonRows />}
          {isError && !isLoading && (
            <p className="py-4 text-sm text-muted-foreground text-center">
              Unable to load token balances.
            </p>
          )}
          {!isLoading && !isError && top10.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground text-center">
              No tokens found.
            </p>
          )}
          {!isLoading && !isError && top10.length > 0 && (
            <div className="divide-y divide-border">
              {top10.map((token, i) => {
                const pct = totalUSD > 0 && token.valueUSD != null
                  ? (token.valueUSD / totalUSD) * 100
                  : 0;
                return (
                  <TokenRow
                    key={token.mint}
                    token={token}
                    percentage={pct}
                    colorIndex={i}
                    animate={animateRows}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
