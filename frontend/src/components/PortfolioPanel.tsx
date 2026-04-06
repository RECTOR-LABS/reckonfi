/**
 * PortfolioPanel — displays wallet token balances fetched via Helius DAS.
 * Polls every 30s via TanStack Query refetchInterval.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchWalletBalances, type TokenBalance } from '@/lib/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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

// ─── Token Row ────────────────────────────────────────────────────────────────

interface TokenRowProps {
  token: TokenBalance;
  percentage: number;
}

function TokenRow({ token, percentage }: TokenRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2 min-w-0">
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
        <Badge variant="outline" className="text-[10px] tabular-nums w-12 justify-center">
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
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['walletBalances'],
    queryFn: fetchWalletBalances,
    refetchInterval: 30_000,
  });

  const top10 = data?.tokens.slice(0, 10) ?? [];
  const totalUSD = data?.totalUSD ?? 0;

  return (
    <Card className="rounded-none border-0 ring-0 flex-1 min-h-0 flex flex-col">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Portfolio
        </CardTitle>
        {!isLoading && !isError && (
          <p className="text-2xl font-bold tracking-tight">{formatUSD(totalUSD)}</p>
        )}
        {isLoading && (
          <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        )}
        {isError && (
          <p className="text-xs text-destructive">
            {error instanceof Error ? error.message : 'Failed to load balances'}
          </p>
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
              {top10.map((token) => {
                const pct = totalUSD > 0 && token.valueUSD != null
                  ? (token.valueUSD / totalUSD) * 100
                  : 0;
                return (
                  <TokenRow key={token.mint} token={token} percentage={pct} />
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
