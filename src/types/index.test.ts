import { describe, it, expect } from 'vitest';
import type {
  Protocol,
  PositionType,
  Volatility,
  Trend,
  Confidence,
  RiskTolerance,
  TokenBalance,
  Position,
  PriceData,
  PortfolioSnapshot,
  Risk,
  ExecutionStep,
  ReasoningResult,
  RiskProfile,
  Decision,
  Alert,
  ProtocolService,
  SwapQuote,
} from './index';

// ---------------------------------------------------------------------------
// Literal union type guards — compile-time checked via satisfies / assignment
// ---------------------------------------------------------------------------

describe('Literal union types', () => {
  it('Protocol values are exhaustive', () => {
    const protocols: Protocol[] = ['kamino', 'drift', 'marginfi'];
    expect(protocols).toHaveLength(3);
  });

  it('PositionType values are exhaustive', () => {
    const types: PositionType[] = [
      'lending',
      'borrowing',
      'perp-long',
      'perp-short',
      'lp',
    ];
    expect(types).toHaveLength(5);
  });

  it('Volatility values are exhaustive', () => {
    const values: Volatility[] = ['low', 'moderate', 'high', 'extreme'];
    expect(values).toHaveLength(4);
  });

  it('Trend values are exhaustive', () => {
    const values: Trend[] = ['bullish', 'neutral', 'bearish'];
    expect(values).toHaveLength(3);
  });

  it('Confidence values are exhaustive', () => {
    const values: Confidence[] = ['low', 'medium', 'high'];
    expect(values).toHaveLength(3);
  });

  it('RiskTolerance values are exhaustive', () => {
    const values: RiskTolerance[] = ['conservative', 'moderate', 'aggressive'];
    expect(values).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// TokenBalance
// ---------------------------------------------------------------------------

describe('TokenBalance interface', () => {
  it('satisfies all required fields', () => {
    const balance: TokenBalance = {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      amount: 10.5,
      usdValue: 1575.0,
    };

    expect(balance.mint).toBe('So11111111111111111111111111111111111111112');
    expect(balance.symbol).toBe('SOL');
    expect(balance.amount).toBe(10.5);
    expect(balance.usdValue).toBe(1575.0);
  });
});

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

describe('Position interface', () => {
  it('satisfies all required fields with populated health and liquidation', () => {
    const position: Position = {
      protocol: 'kamino',
      type: 'lending',
      tokens: [
        {
          mint: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          amount: 5,
          usdValue: 750,
        },
      ],
      value: 750,
      healthFactor: 1.8,
      liquidationPrice: 90.0,
      pnl: 25.5,
      apy: 6.2,
      metadata: { collateralFactor: 0.75 },
    };

    expect(position.protocol).toBe('kamino');
    expect(position.type).toBe('lending');
    expect(position.tokens).toHaveLength(1);
    expect(position.value).toBe(750);
    expect(position.healthFactor).toBe(1.8);
    expect(position.liquidationPrice).toBe(90.0);
    expect(position.pnl).toBe(25.5);
    expect(position.apy).toBe(6.2);
    expect(position.metadata).toMatchObject({ collateralFactor: 0.75 });
  });

  it('accepts null healthFactor and liquidationPrice', () => {
    const position: Position = {
      protocol: 'drift',
      type: 'perp-long',
      tokens: [],
      value: 0,
      healthFactor: null,
      liquidationPrice: null,
      pnl: 0,
      apy: 0,
      metadata: {},
    };

    expect(position.healthFactor).toBeNull();
    expect(position.liquidationPrice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PriceData
// ---------------------------------------------------------------------------

describe('PriceData interface', () => {
  it('satisfies all required fields', () => {
    const price: PriceData = {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      price: 150.0,
      change24h: -2.5,
    };

    expect(price.price).toBe(150.0);
    expect(price.change24h).toBe(-2.5);
  });
});

// ---------------------------------------------------------------------------
// RiskProfile & Decision (used inside PortfolioSnapshot)
// ---------------------------------------------------------------------------

describe('RiskProfile interface', () => {
  it('satisfies all required fields', () => {
    const profile: RiskProfile = {
      tolerance: 'moderate',
      avgLeverage: 1.5,
      historicalActions: ['reduce_exposure', 'close_perp'],
    };

    expect(profile.tolerance).toBe('moderate');
    expect(profile.avgLeverage).toBe(1.5);
    expect(profile.historicalActions).toContain('reduce_exposure');
  });
});

describe('Decision interface', () => {
  it('satisfies all required fields with a null outcome', () => {
    const decision: Decision = {
      timestamp: 1712345678000,
      recommendation: 'Reduce leverage to 1.2x',
      userAction: 'close_perp',
      outcome: null,
    };

    expect(decision.timestamp).toBe(1712345678000);
    expect(decision.outcome).toBeNull();
  });

  it('accepts a non-null outcome', () => {
    const decision: Decision = {
      timestamp: 1712345600000,
      recommendation: 'Add collateral',
      userAction: 'add_collateral',
      outcome: 'avoided_liquidation',
    };

    expect(decision.outcome).toBe('avoided_liquidation');
  });
});

// ---------------------------------------------------------------------------
// PortfolioSnapshot
// ---------------------------------------------------------------------------

describe('PortfolioSnapshot interface', () => {
  it('satisfies all required fields', () => {
    const solToken: TokenBalance = {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      amount: 10,
      usdValue: 1500,
    };

    const position: Position = {
      protocol: 'marginfi',
      type: 'borrowing',
      tokens: [solToken],
      value: 500,
      healthFactor: 2.0,
      liquidationPrice: 80.0,
      pnl: -10,
      apy: 3.5,
      metadata: {},
    };

    const priceData: PriceData = {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      price: 150,
      change24h: 1.2,
    };

    const snapshot: PortfolioSnapshot = {
      wallet: {
        sol: 10,
        tokens: [solToken],
        totalUSD: 1500,
      },
      positions: [position],
      exposure: {
        byToken: new Map([['SOL', 1500]]),
        byProtocol: new Map([['marginfi', 500]]),
        leverageRatio: 1.2,
      },
      market: {
        prices: new Map([['So11111111111111111111111111111111111111112', priceData]]),
        volatility: 'moderate',
        trend: 'bullish',
      },
      riskProfile: {
        tolerance: 'aggressive',
        avgLeverage: 1.8,
        historicalActions: [],
      },
      recentDecisions: [],
    };

    expect(snapshot.wallet.sol).toBe(10);
    expect(snapshot.wallet.totalUSD).toBe(1500);
    expect(snapshot.positions).toHaveLength(1);
    expect(snapshot.exposure.byToken.get('SOL')).toBe(1500);
    expect(snapshot.exposure.byProtocol.get('marginfi')).toBe(500);
    expect(snapshot.exposure.leverageRatio).toBe(1.2);
    expect(snapshot.market.volatility).toBe('moderate');
    expect(snapshot.market.trend).toBe('bullish');
    expect(snapshot.market.prices.get('So11111111111111111111111111111111111111112')).toMatchObject({
      price: 150,
    });
    expect(snapshot.riskProfile.tolerance).toBe('aggressive');
    expect(snapshot.recentDecisions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

describe('Risk interface', () => {
  it('satisfies all fields with a linked position', () => {
    const position: Position = {
      protocol: 'drift',
      type: 'perp-short',
      tokens: [],
      value: 200,
      healthFactor: 1.1,
      liquidationPrice: 160,
      pnl: -15,
      apy: 0,
      metadata: {},
    };

    const risk: Risk = {
      severity: 'high',
      description: 'Position approaching liquidation threshold',
      position,
    };

    expect(risk.severity).toBe('high');
    expect(risk.position).not.toBeNull();
    expect(risk.position?.protocol).toBe('drift');
  });

  it('accepts null position', () => {
    const risk: Risk = {
      severity: 'low',
      description: 'Market volatility elevated',
      position: null,
    };

    expect(risk.position).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ExecutionStep
// ---------------------------------------------------------------------------

describe('ExecutionStep interface', () => {
  it('satisfies all required fields', () => {
    const step: ExecutionStep = {
      action: 'SWAP',
      description: 'Swap SOL for USDC via Jupiter',
      params: { inputMint: 'So11111111111111111111111111111111111111112', amount: 5 },
    };

    expect(step.action).toBe('SWAP');
    expect(step.params).toHaveProperty('inputMint');
  });
});

// ---------------------------------------------------------------------------
// ReasoningResult
// ---------------------------------------------------------------------------

describe('ReasoningResult interface', () => {
  it('satisfies all required fields without optional executionPlan', () => {
    const result: ReasoningResult = {
      analysis: 'Portfolio is moderately leveraged with acceptable health factors.',
      risks: [],
      recommendation: {
        action: 'HOLD',
        reasoning: 'Current positions are within safe thresholds.',
        confidence: 'high',
      },
    };

    expect(result.analysis).toBeTruthy();
    expect(result.risks).toHaveLength(0);
    expect(result.recommendation.action).toBe('HOLD');
    expect(result.recommendation.confidence).toBe('high');
    expect(result.executionPlan).toBeUndefined();
  });

  it('satisfies all fields with an executionPlan', () => {
    const result: ReasoningResult = {
      analysis: 'Liquidation risk detected.',
      risks: [{ severity: 'critical', description: 'Health factor below 1.05', position: null }],
      recommendation: {
        action: 'REDUCE_POSITION',
        reasoning: 'Prevent liquidation by reducing collateral exposure.',
        confidence: 'medium',
      },
      executionPlan: {
        steps: [
          {
            action: 'WITHDRAW',
            description: 'Withdraw 20% of lending position',
            params: { percent: 20 },
          },
        ],
        estimatedCost: 0.005,
        slippageImpact: 0.1,
      },
    };

    expect(result.executionPlan?.steps).toHaveLength(1);
    expect(result.executionPlan?.estimatedCost).toBe(0.005);
    expect(result.executionPlan?.slippageImpact).toBe(0.1);
  });
});

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

describe('Alert interface', () => {
  it('satisfies all required fields', () => {
    const alert: Alert = {
      id: 'alert-001',
      type: 'liquidation',
      severity: 'critical',
      message: 'Health factor dropped below 1.05 on Kamino position',
      position: null,
      createdAt: Date.now(),
      acknowledged: false,
    };

    expect(alert.id).toBe('alert-001');
    expect(alert.type).toBe('liquidation');
    expect(alert.severity).toBe('critical');
    expect(alert.acknowledged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ProtocolService (structural / duck-type check)
// ---------------------------------------------------------------------------

describe('ProtocolService interface', () => {
  it('is satisfied by an object with a getPositions method', () => {
    const service: ProtocolService = {
      getPositions: async (_walletAddress: string): Promise<Position[]> => [],
    };

    expect(typeof service.getPositions).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// SwapQuote
// ---------------------------------------------------------------------------

describe('SwapQuote interface', () => {
  it('satisfies all required fields', () => {
    const quote: SwapQuote = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inputAmount: 1,
      outputAmount: 148.5,
      slippage: 0.5,
      route: 'Jupiter V6',
      priceImpact: 0.02,
    };

    expect(quote.inputAmount).toBe(1);
    expect(quote.outputAmount).toBe(148.5);
    expect(quote.priceImpact).toBe(0.02);
  });
});
