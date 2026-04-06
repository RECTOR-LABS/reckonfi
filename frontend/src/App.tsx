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
    },
  ]);

  // Demo status values — in production driven by the risk calculator API
  const healthScore = 78;
  const trend: MarketTrend = 'Neutral';
  const volatility: VolatilityLevel = 'Medium';

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <span className="text-base font-semibold tracking-tight">ReckonFi</span>
        {walletAddress && (
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
            {truncateAddress(walletAddress)}
          </span>
        )}
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: Portfolio + Alerts */}
        <aside className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
          {/* PortfolioPanel fills remaining height, AlertFeed is fixed at bottom */}
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
