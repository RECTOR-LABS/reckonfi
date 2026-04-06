import type { Plugin } from '@elizaos/core';

import { checkBalanceAction } from './actions/check-balance';
import { analyzePortfolioAction } from './actions/analyze-portfolio';
import { swapTokensAction } from './actions/swap-tokens';
import { setAlertAction } from './actions/set-alert';
import { monitorPositionAction } from './actions/monitor-position';

import { walletProvider } from './providers/wallet-provider';
import { priceProvider } from './providers/price-provider';
import { positionProvider } from './providers/position-provider';
import { marketContextProvider } from './providers/market-context-provider';

import { riskProfilerEvaluator } from './evaluators/risk-profiler';
import { decisionTrackerEvaluator } from './evaluators/decision-tracker';

export const reckonfiPlugin: Plugin = {
  name: 'plugin-reckonfi',
  description: 'ReckonFi — Personal Solana DeFi reasoning agent',
  actions: [checkBalanceAction, analyzePortfolioAction, swapTokensAction, setAlertAction, monitorPositionAction],
  providers: [walletProvider, priceProvider, positionProvider, marketContextProvider],
  evaluators: [riskProfilerEvaluator, decisionTrackerEvaluator],
};

export default reckonfiPlugin;
