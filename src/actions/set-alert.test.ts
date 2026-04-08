import { describe, it, expect, beforeEach } from 'vitest';
import type { IAgentRuntime } from '@elizaos/core';
import { setAlertAction, getAlerts, clearAlerts } from './set-alert';
import {
  createMockMessage,
  createMockState,
  createMockCallback,
} from '../test/mocks';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setAlertAction', () => {
  beforeEach(() => {
    clearAlerts();
  });

  // --- metadata ---

  it('has the correct name', () => {
    expect(setAlertAction.name).toBe('SET_ALERT');
  });

  it('similes includes ALERT and NOTIFY', () => {
    expect(setAlertAction.similes).toContain('ALERT');
    expect(setAlertAction.similes).toContain('NOTIFY');
  });

  // --- validate ---

  describe('validate()', () => {
    const runtime = {} as IAgentRuntime;

    it('returns true for message containing "alert"', async () => {
      const msg = createMockMessage('Set an alert for SOL at $200');
      expect(await setAlertAction.validate(runtime, msg)).toBe(true);
    });

    it('returns true for message containing "notify"', async () => {
      const msg = createMockMessage('Notify me when BTC hits $100k');
      expect(await setAlertAction.validate(runtime, msg)).toBe(true);
    });

    it('returns true for message containing "warn"', async () => {
      const msg = createMockMessage('Warn me if health factor drops below 1.5');
      expect(await setAlertAction.validate(runtime, msg)).toBe(true);
    });

    it('returns true for message containing "watch"', async () => {
      const msg = createMockMessage('Watch my SOL position');
      expect(await setAlertAction.validate(runtime, msg)).toBe(true);
    });

    it('returns false for unrelated message', async () => {
      const msg = createMockMessage('What is the price of ETH?');
      expect(await setAlertAction.validate(runtime, msg)).toBe(false);
    });

    it('is case-insensitive', async () => {
      const msg = createMockMessage('ALERT ME WHEN SOL DROPS');
      expect(await setAlertAction.validate(runtime, msg)).toBe(true);
    });
  });

  // --- handler: creates alert ---

  describe('handler() — alert creation', () => {
    it('stores an alert in module-level storage', async () => {
      const runtime = {} as IAgentRuntime;
      const callback = createMockCallback();

      expect(getAlerts()).toHaveLength(0);

      await setAlertAction.handler(
        runtime,
        createMockMessage('alert me when SOL drops to $100'),
        createMockState(),
        {},
        callback,
      );

      expect(getAlerts()).toHaveLength(1);
    });

    it('stored alert has correct shape', async () => {
      const runtime = {} as IAgentRuntime;
      const callback = createMockCallback();
      const text = 'alert me when SOL drops to $100';

      await setAlertAction.handler(
        runtime,
        createMockMessage(text),
        createMockState(),
        {},
        callback,
      );

      const alerts = getAlerts();
      expect(alerts[0]).toMatchObject({
        type: 'price',
        severity: 'info',
        message: text,
        position: null,
        acknowledged: false,
      });
      expect(alerts[0].id).toMatch(/^alert-\d+$/);
      expect(typeof alerts[0].createdAt).toBe('number');
    });

    it('accumulates multiple alerts across calls', async () => {
      const runtime = {} as IAgentRuntime;

      await setAlertAction.handler(
        runtime,
        createMockMessage('notify me when ETH crosses $2000'),
        createMockState(),
        {},
        createMockCallback(),
      );

      await setAlertAction.handler(
        runtime,
        createMockMessage('watch my USDC position'),
        createMockState(),
        {},
        createMockCallback(),
      );

      expect(getAlerts()).toHaveLength(2);
    });

    it('clearAlerts() resets storage to empty', async () => {
      const runtime = {} as IAgentRuntime;

      await setAlertAction.handler(
        runtime,
        createMockMessage('alert me when SOL drops'),
        createMockState(),
        {},
        createMockCallback(),
      );

      expect(getAlerts()).toHaveLength(1);
      clearAlerts();
      expect(getAlerts()).toHaveLength(0);
    });
  });

  // --- handler: callback ---

  describe('handler() — callback', () => {
    it('calls callback with confirmation text', async () => {
      const runtime = {} as IAgentRuntime;
      const callback = createMockCallback();

      await setAlertAction.handler(
        runtime,
        createMockMessage('alert me when SOL drops to $100'),
        createMockState(),
        {},
        callback,
      );

      expect(callback.calls.length).toBeGreaterThan(0);
      expect(typeof callback.calls[0].text).toBe('string');
      expect(callback.calls[0].text.length).toBeGreaterThan(0);
    });

    it('callback text mentions in-memory limitation', async () => {
      const runtime = {} as IAgentRuntime;
      const callback = createMockCallback();

      await setAlertAction.handler(
        runtime,
        createMockMessage('notify me when price drops'),
        createMockState(),
        {},
        callback,
      );

      // Should note alerts are in-memory only
      const text = callback.calls[0].text.toLowerCase();
      expect(
        text.includes('memory') || text.includes('session') || text.includes('restart'),
      ).toBe(true);
    });

    it('returns success with the created alert', async () => {
      const runtime = {} as IAgentRuntime;
      const callback = createMockCallback();

      const result = await setAlertAction.handler(
        runtime,
        createMockMessage('alert me when SOL drops to $100'),
        createMockState(),
        {},
        callback,
      );

      expect(result).toMatchObject({ success: true });
    });
  });
});
