import { describe, expect, it } from 'vitest';
import {
  stateIndex, methodCode, trimDesc, segFromContract, extractRows, STATES, METHODS, UNSPSC_SEGMENTS,
} from '../pipeline/collect.mjs';

describe('stateIndex', () => {
  it('maps abbreviations', () => expect(STATES[stateIndex('NSW')]).toBe('NSW'));
  it('maps full names', () => expect(STATES[stateIndex('Victoria')]).toBe('VIC'));
  it('maps overseas variants', () => expect(STATES[stateIndex('Outside Australia')]).toBe('Overseas'));
  it('falls back to Unknown', () => expect(STATES[stateIndex('')]).toBe('Unknown'));
  it('falls back for gibberish', () => expect(STATES[stateIndex('Narnia')]).toBe('Unknown'));
});

describe('methodCode', () => {
  it('detects limited', () => expect(METHODS[methodCode('Limited tender')]).toBe('Limited tender'));
  it('detects open', () => expect(METHODS[methodCode('Open tender')]).toBe('Open tender'));
  it('detects prequalified', () => expect(METHODS[methodCode('Prequalified tender')]).toBe('Prequalified tender'));
  it('treats sole-source as limited', () => expect(methodCode('Sole source')).toBe(0));
  it('falls back to other', () => expect(METHODS[methodCode('')]).toBe('Other'));
});

describe('trimDesc', () => {
  it('collapses whitespace', () => expect(trimDesc('a   b\n c')).toBe('a b c'));
  it('truncates long text', () => {
    const long = 'x'.repeat(200);
    expect(trimDesc(long).length).toBeLessThanOrEqual(120);
    expect(trimDesc(long).endsWith('…')).toBe(true);
  });
  it('handles empty', () => expect(trimDesc('')).toBe(''));
});

describe('segFromContract', () => {
  it('extracts the two-digit UNSPSC segment', () => {
    expect(segFromContract({ items: [{ classification: { id: '43211500' } }] })).toBe('43');
  });
  it('ignores unknown segments and finds a known one', () => {
    expect(segFromContract({ items: [{ classification: { id: '00000000' } }, { classification: { id: '80101500' } }] })).toBe('80');
  });
  it('returns null when no classification', () => {
    expect(segFromContract({ items: [] })).toBeNull();
  });
  it('maps to a real segment name', () => {
    const seg = segFromContract({ items: [{ classification: { id: '43000000' } }] });
    expect((UNSPSC_SEGMENTS as Record<string, string>)[seg!]).toContain('Information Technology');
  });
});

describe('extractRows', () => {
  const ctx = () => {
    const supDict = new Map<string, number>();
    const agDict = new Map<string, number>();
    const usedSegs = new Set<string>();
    const dictIndex = (map: Map<string, number>, name: string) => {
      let i = map.get(name);
      if (i === undefined) { i = map.size; map.set(name, i); }
      return i;
    };
    return { supDict, agDict, usedSegs, dictIndex };
  };

  const release = {
    date: '2026-01-05T04:21:06Z',
    tender: { procurementMethodDetails: 'Limited tender' },
    awards: [{ id: 'AW1', suppliers: [{ id: 'sup1', name: 'Curtin University' }] }],
    parties: [
      { id: 'sup1', name: 'Curtin University', roles: ['supplier'], address: { region: 'WA' } },
      { id: 'ag1', name: 'CSIRO', roles: ['procuringEntity'] },
    ],
    contracts: [{
      id: 'CN4210722', awardID: 'AW1',
      value: { amount: '901605.90', currency: 'AUD' },
      dateSigned: '2025-12-21T23:26:29Z',
      description: 'Secondment - Chief Scientist',
      items: [{ classification: { id: '80111600' } }],
    }],
  };

  it('extracts one row per valued contract', () => {
    const rows = extractRows(release, ctx());
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r[2]).toBe(901606); // rounded amount
    expect(r[3]).toBe('2025-12-21'); // date signed, trimmed to day
    expect(r[4]).toBe('80'); // UNSPSC segment
    expect(r[5]).toBe(0); // limited tender
    expect(STATES[r[6]]).toBe('WA');
    expect(r[8]).toBe('CN4210722'); // CN reference
  });

  it('populates the dictionaries', () => {
    const c = ctx();
    extractRows(release, c);
    expect(c.supDict.get('Curtin University')).toBe(0);
    expect(c.agDict.get('CSIRO')).toBe(0);
    expect(c.usedSegs.has('80')).toBe(true);
  });

  it('skips contracts with no value', () => {
    const noVal = { ...release, contracts: [{ ...release.contracts[0], value: undefined }] };
    expect(extractRows(noVal, ctx()).length).toBe(0);
  });

  it('skips releases with no procuring entity', () => {
    const noAg = { ...release, parties: [{ id: 'sup1', name: 'Curtin University', roles: ['supplier'] }] };
    expect(extractRows(noAg, ctx()).length).toBe(0);
  });
});
