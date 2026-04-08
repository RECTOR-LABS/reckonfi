export type Protocol = 'kamino' | 'drift' | 'marginfi';
export type PositionType = 'lending' | 'borrowing' | 'perp-long' | 'perp-short' | 'lp';
export type Volatility = 'low' | 'moderate' | 'high' | 'extreme';
export type Trend = 'bullish' | 'neutral' | 'bearish';
export type Confidence = 'low' | 'medium' | 'high';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  usdValue: number;
}

export interface Position {
  protocol: Protocol;
  type: PositionType;
  tokens: TokenBalance[];
  value: number;
  healthFactor: number | null;
  liquidationPrice: number | null;
  pnl: number;
  apy: number;
  metadata: Record<string, unknown>;
}

export interface PriceData {
  mint: string;
  symbol: string;
  price: number;
  change24h: number;
}

export interface PortfolioSnapshot {
  wallet: { sol: number; tokens: TokenBalance[]; totalUSD: number };
  positions: Position[];
  exposure: {
    byToken: Map<string, number>;
    byProtocol: Map<string, number>;
    leverageRatio: number;
  };
  market: {
    prices: Map<string, PriceData>;
    volatility: Volatility;
    trend: Trend;
  };
  riskProfile: RiskProfile;
  recentDecisions: Decision[];
}

export interface Risk {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position: Position | null;
}

export interface ExecutionStep {
  action: string;
  description: string;
  params: Record<string, unknown>;
}

export interface ReasoningResult {
  analysis: string;
  risks: Risk[];
  recommendation: {
    action: string;
    reasoning: string;
    confidence: Confidence;
  };
  executionPlan?: {
    steps: ExecutionStep[];
    estimatedCost: number;
    slippageImpact: number;
  };
}

export interface RiskProfile {
  tolerance: RiskTolerance;
  avgLeverage: number;
  historicalActions: string[];
}

export interface Decision {
  timestamp: number;
  recommendation: string;
  userAction: string;
  outcome: string | null;
}

export interface Alert {
  id: string;
  type: 'liquidation' | 'price' | 'health';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  position: Position | null;
  createdAt: number;
  acknowledged: boolean;
}

export interface ProtocolService {
  getPositions(walletAddress: string): Promise<Position[]>;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  slippage: number;
  route: string;
  priceImpact: number;
}
