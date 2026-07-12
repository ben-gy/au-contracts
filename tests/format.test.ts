import { describe, expect, it } from 'vitest';
import { money, moneyFull, num, pct, monthLabel, dateLabel, financialYear, truncate, esc } from '../src/format';

describe('money', () => {
  it('formats billions', () => { expect(money(1_234_000_000)).toBe('$1.23B'); });
  it('formats millions', () => { expect(money(34_500_000)).toBe('$34.5M'); });
  it('formats thousands', () => { expect(money(12_300)).toBe('$12K'); });
  it('formats small values', () => { expect(money(945)).toBe('$945'); });
  it('handles zero', () => { expect(money(0)).toBe('$0'); });
  it('handles negatives', () => { expect(money(-2_000_000)).toBe('-$2.0M'); });
});

describe('moneyFull', () => {
  it('adds separators', () => { expect(moneyFull(1234567)).toBe('$1,234,567'); });
  it('rounds', () => { expect(moneyFull(1234.9)).toBe('$1,235'); });
  it('handles zero', () => { expect(moneyFull(0)).toBe('$0'); });
  it('handles negatives', () => { expect(moneyFull(-1234)).toBe('-$1,234'); });
});

describe('num', () => {
  it('formats with separators', () => { expect(num(121029)).toBe('121,029'); });
  it('handles zero', () => { expect(num(0)).toBe('0'); });
});

describe('pct', () => {
  it('formats a ratio', () => { expect(pct(0.425)).toBe('42.5%'); });
  it('respects digits', () => { expect(pct(0.425, 0)).toBe('43%'); });
  it('handles zero', () => { expect(pct(0)).toBe('0.0%'); });
});

describe('monthLabel', () => {
  it('formats a valid month', () => { expect(monthLabel('2024-06')).toBe('Jun 2024'); });
  it('handles january', () => { expect(monthLabel('2025-01')).toBe('Jan 2025'); });
  it('returns input on bad format', () => { expect(monthLabel('nope')).toBe('nope'); });
  it('returns input on bad month', () => { expect(monthLabel('2024-13')).toBe('2024-13'); });
});

describe('dateLabel', () => {
  it('formats an ISO date', () => { expect(dateLabel('2025-06-30')).toBe('30 Jun 2025'); });
  it('handles datetime strings', () => { expect(dateLabel('2023-07-01T00:00:00Z')).toBe('1 Jul 2023'); });
  it('handles empty', () => { expect(dateLabel('')).toBe('—'); });
});

describe('financialYear', () => {
  it('maps July into new FY', () => { expect(financialYear('2024-07-15')).toBe('2024-25'); });
  it('maps June into prior FY', () => { expect(financialYear('2024-06-30')).toBe('2023-24'); });
  it('handles January', () => { expect(financialYear('2025-01-01')).toBe('2024-25'); });
  it('handles bad input', () => { expect(financialYear('')).toBe('—'); });
});

describe('truncate', () => {
  it('leaves short strings', () => { expect(truncate('hello', 10)).toBe('hello'); });
  it('truncates long strings', () => { expect(truncate('hello world', 6)).toBe('hello…'); });
  it('handles empty', () => { expect(truncate('', 5)).toBe(''); });
});

describe('esc', () => {
  it('escapes html', () => { expect(esc('<a href="x">&y</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;y&lt;/a&gt;'); });
  it('handles null-ish', () => { expect(esc(null as unknown as string)).toBe(''); });
});
