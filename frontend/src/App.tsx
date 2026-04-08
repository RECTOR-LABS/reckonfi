import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import './index.css';

import { PortfolioPanel } from '@/components/PortfolioPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { AlertFeed, type Alert } from '@/components/AlertFeed';
import { StatusBar, type MarketTrend, type VolatilityLevel } from '@/components/StatusBar';

// ─── Query Client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

// ─── Wallet address truncation ────────────────────────────────────────────────

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

// ─── Dashboard shell ──────────────────────────────────────────────────────────

function Dashboard() {
  const walletAddress = import.meta.env.VITE_WALLET_ADDRESS as string | undefined;

  // Demo alerts — in production these would come from the backend/websocket
  const [alerts] = useState<Alert[]>([
    {
      id: 'a1',
      severity: 'info',
      message: 'Portfolio sync complete.',
      timestamp: new Date(),
    },
    {
      id: 'a2',
      severity: 'warning',
      message: 'SOL concentration above 60% — consider rebalancing.',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
    },
  ]);

  // Demo status values — in production driven by the risk calculator API
  const healthScore = 78;
  const trend: MarketTrend = 'Neutral';
  const volatility: VolatilityLevel = 'Medium';

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b shrink-0 relative overflow-hidden">
        {/* Subtle purple→blue gradient accent strip along the top */}
        <div
          className="absolute inset-x-0 top-0 h-0.5 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #8b5cf6 0%, #3b82f6 50%, #06b6d4 100%)',
          }}
          aria-hidden="true"
        />

        {/* Brand */}
        <div className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-tight">ReckonFi</span>
          <span className="text-[10px] text-muted-foreground tracking-wide mt-0.5">
            Solana DeFi Reasoning Agent
          </span>
        </div>

        {/* Wallet badge */}
        {walletAddress && (
          <div className="flex items-center gap-1.5">
            {/* Live indicator dot */}
            <span className="relative flex size-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-green-500" />
            </span>
            <span className="text-xs font-mono text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-full">
              {truncateAddress(walletAddress)}
            </span>
          </div>
        )}
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: Portfolio + Alerts */}
        <aside className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <PortfolioPanel />
          </div>
          <AlertFeed alerts={alerts} />
        </aside>

        {/* Right panel: Chat */}
        <main className="flex-1 min-w-0 overflow-hidden">
          <ChatPanel />
        </main>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <StatusBar
        healthScore={healthScore}
        trend={trend}
        volatility={volatility}
      />
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
