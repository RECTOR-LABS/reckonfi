import { describe, it, expect, beforeEach } from 'vitest';
import type { IAgentRuntime } from '@elizaos/core';
import {
  riskProfilerEvaluator,
  getRiskProfile,
  clearRiskProfilerState,
} from './risk-profiler';
import { createMockMessage, createMockState } from '../test/mocks';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('riskProfilerEvaluator', () => {
  beforeEach(() => {
    clearRiskProfilerState();
  });

  // --- metadata ---

  it('has the correct name', () => {
    expect(riskProfilerEvaluator.name).toBe('RISK_PROFILER');
  });

  it('alwaysRun is true', () => {
    expect(riskProfilerEvaluator.alwaysRun).toBe(true);
  });

  it('examples is an empty array', () => {
    expect(riskProfilerEvaluator.examples).toEqual([]);
  });

  // --- validate ---

  describe('validate()', () => {
    const runtime = {} as IAgentRuntime;

    it('always returns true regardless of message content', async () => {
      expect(
        await riskProfilerEvaluator.validate(runtime, createMockMessage('hello')),
      ).toBe(true);

      expect(
        await riskProfilerEvaluator.validate(
          runtime,
          createMockMessage(''),
        ),
      ).toBe(true);

      expect(
        await riskProfilerEvaluator.validate(
          runtime,
          createMockMessage('yolo max leverage long SOL'),
        ),
      ).toBe(true);
    });
  });

  // --- getRiskProfile: initial state ---

  describe('getRiskProfile() — initial state', () => {
    it('returns moderate tolerance before any actions', () => {
      const profile = getRiskProfile();
      expect(profile.tolerance).toBe('moderate');
    });

    it('returns empty historicalActions initially', () => {
      const profile = getRiskProfile();
      expect(profile.historicalActions).toHaveLength(0);
    });

    it('returns avgLeverage of 0 initially', () => {
      const profile = getRiskProfile();
      expect(profile.avgLeverage).toBe(0);
    });
  });

  // --- handler: records messages ---

  describe('handler() — records messages', () => {
    it('records message text in historicalActions after handler call', async () => {
      const runtime = {} as IAgentRuntime;
      const text = 'I want to reduce my exposure and deleverage';

      await riskProfilerEvaluator.handler(
        runtime,
        createMockMessage(text),
        createMockState(),
      );

      const profile = getRiskProfile();
      expect(profile.historicalActions).toContain(text);
    });

    it('keeps last 50 actions (drops oldest when over limit)', async () => {
      const runtime = {} as IAgentRuntime;

      for (let i = 0; i < 55; i++) {
        await riskProfilerEvaluator.handler(
          runtime,
          createMockMessage(`action ${i}`),
          createMockState(),
        );
      }

      const profile = getRiskProfile();
      expect(profile.historicalActions.length).toBe(50);
      // oldest messages (0-4) should be dropped; newest (54) should be present
      expect(profile.historicalActions).toContain('action 54');
      expect(profile.historicalActions).not.toContain('action 0');
    });
  });

  // --- handler: risk tolerance classification ---

  describe('handler() — risk tolerance classification', () => {
    it('classifies as conservative when majority of signals are conservative', async () => {
      const runtime = {} as IAgentRuntime;
      const conservativeMsgs = [
        'reduce my exposure',
        'add more collateral',
        'deleverage the position',
        'move to stables',
        'protect the portfolio',
        'keep it safe',
      ];

      for (const msg of conservativeMsgs) {
        await riskProfilerEvaluator.handler(
          runtime,
          createMockMessage(msg),
          createMockState(),
        );
      }

      const profile = getRiskProfile();
      expect(profile.tolerance).toBe('conservative');
    });

    it('classifies as aggressive when majority of signals are aggressive', async () => {
      const runtime = {} as IAgentRuntime;
      const aggressiveMsgs = [
        'lever up max',
        'go long SOL',
        'short everything',
        'yolo into it',
        'max leverage',
        'ape in now',
      ];

      for (const msg of aggressiveMsgs) {
        await riskProfilerEvaluator.handler(
          runtime,
          createMockMessage(msg),
          createMockState(),
        );
      }

      const profile = getRiskProfile();
      expect(profile.tolerance).toBe('aggressive');
    });

    it('stays moderate when fewer than 5 actions recorded', async () => {
      const runtime = {} as IAgentRuntime;

      for (let i = 0; i < 4; i++) {
        await riskProfilerEvaluator.handler(
          runtime,
          createMockMessage('reduce exposure'),
          createMockState(),
        );
      }

      const profile = getRiskProfile();
      // < 5 actions → no classification → remains moderate
      expect(profile.tolerance).toBe('moderate');
    });

    it('classifies as moderate when signals are mixed', async () => {
      const runtime = {} as IAgentRuntime;
      const mixedMsgs = [
        'reduce a bit',
        'lever slightly',
        'keep it safe',
        'go long a small amount',
        'add some collateral',
        'consider shorts',
      ];

      for (const msg of mixedMsgs) {
        await riskProfilerEvaluator.handler(
          runtime,
          createMockMessage(msg),
          createMockState(),
        );
      }

      const profile = getRiskProfile();
      expect(profile.tolerance).toBe('moderate');
    });
  });
});
