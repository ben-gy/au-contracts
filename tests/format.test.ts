import { describe, expect, it } from 'vitest';
import { money, moneyFull, num, pct, prettyDate, prettyMonth, relativeTime, segColor } from '../src/format.ts';

describe('money', () => {
  it('formats billions', () => expect(money(1_250_000_000)).toBe('$1.3B'));
  it('formats millions', () => expect(money(340_400_000)).toBe('$340.4M'));
  it('formats thousands', () => expect(money(12_500)).toBe('$12.5K'));
  it('formats small amounts', () => expect(money(980)).toBe('$980'));
  it('handles zero', () => expect(money(0)).toBe('$0'));
  it('handles negatives', () => expect(money(-2_000_000)).toBe('-$2.0M'));
});

describe('moneyFull', () => {
  it('adds separators', () => expect(moneyFull(1234567)).toBe('$1,234,567'));
  it('rounds', () => expect(moneyFull(99.6)).toBe('$100'));
});

describe('num', () => {
  it('formats with separators', () => expect(num(66002)).toBe('66,002'));
  it('handles zero', () => expect(num(0)).toBe('0'));
});

describe('pct', () => {
  it('computes a percentage', () => expect(pct(1, 4)).toBe('25.0%'));
  it('guards divide-by-zero', () => expect(pct(5, 0)).toBe('0.0%'));
});

describe('prettyDate / prettyMonth', () => {
  it('formats an ISO date', () => expect(prettyDate('2026-03-23')).toBe('23 Mar 2026'));
  it('handles empty', () => expect(prettyDate('')).toBe('—'));
  it('formats a month', () => expect(prettyMonth('2025-07')).toBe('Jul 2025'));
});

describe('relativeTime', () => {
  const now = Date.parse('2026-07-12T12:00:00Z');
  it('reports minutes', () => expect(relativeTime('2026-07-12T11:30:00Z', now)).toBe('30m ago'));
  it('reports hours', () => expect(relativeTime('2026-07-12T09:00:00Z', now)).toBe('3h ago'));
  it('reports days', () => expect(relativeTime('2026-07-10T12:00:00Z', now)).toBe('2d ago'));
});

describe('segColor', () => {
  it('is deterministic', () => expect(segColor('43')).toBe(segColor('43')));
  it('returns a hex colour', () => expect(segColor('80')).toMatch(/^#[0-9a-f]{6}$/i));
});
