// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// ── Shapes emitted by pipeline/aggregate.mjs ────────────────────────────────
// aggregates.json holds every view except the raw searchable table; that lives
// in contracts.json (the largest N contracts, with a disclosed floor amount).

export interface Meta {
  generated: string;
  fyLabel: string; // e.g. "FY2025-26"
  fyStart: number;
  windowFrom: string; // 'YYYY-MM-DD'
  windowTo: string;
  minDate: string;
  maxDate: string;
  count: number;
  totalValue: number;
  supplierCount: number;
  agencyCount: number;
  states: string[];
  methods: string[];
  source: string;
  tableCap: number;
  tableCount: number;
  tableMinAmount: number;
  tableIsCapped: boolean;
}

export interface SupplierRow {
  name: string;
  slug: string;
  value: number;
  count: number;
  avg: number;
  agencies: number;
  limitedPct: number;
  topSeg: string | null;
  state: number;
}

export interface AgencyRow {
  name: string;
  slug: string;
  value: number;
  count: number;
  avg: number;
  suppliers: number;
  limitedPct: number;
  topSeg: string | null;
}

export interface CategoryRow {
  seg: string;
  name: string;
  value: number;
  count: number;
}

export interface MethodRow {
  code: number;
  label: string;
  value: number;
  count: number;
}

export interface StateRow {
  i: number;
  state: string;
  value: number;
  count: number;
}

export interface MonthRow {
  ym: string;
  value: number;
  count: number;
}

export interface HistoRow {
  label: string;
  count: number;
  value: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: 'agency' | 'supplier';
  value: number;
  seg: string | null;
}

export interface NetworkLink {
  source: number;
  target: number;
  value: number;
}

export interface Network {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface Flow {
  agencies: string[];
  categories: string[];
  links: { a: number; c: number; value: number }[];
}

export interface Matrix {
  agencies: { name: string; slug: string }[];
  categories: string[];
  grid: number[][];
}

export interface Finding {
  severity: 'info' | 'warn' | 'alert';
  title: string;
  detail: string;
}

export interface Aggregates {
  meta: Meta;
  monthly: MonthRow[];
  methods: MethodRow[];
  states: StateRow[];
  categories: CategoryRow[];
  histogram: HistoRow[];
  topSuppliers: SupplierRow[];
  topAgencies: AgencyRow[];
  network: Network;
  flow: Flow;
  matrix: Matrix;
  findings: Finding[];
  segNames: [string, string][];
}

// ── contracts.json (searchable table subset) ────────────────────────────────
export const SUP = 0, AG = 1, AMT = 2, DATE = 3, SEG = 4, METHOD = 5, STATE = 6, DESC = 7, CN = 8;
export type TableRow = [number, number, number, string, string, number, number, string, string];

export interface ContractTable {
  suppliers: string[];
  agencies: string[];
  states: string[];
  methods: string[];
  segs: [string, string][];
  rows: TableRow[];
}

export interface TableFilters {
  search: string;
  seg: string; // '' = all
  method: number; // -1 = all
  state: number; // -1 = all
  sort: 'value' | 'date';
}

export const METHOD_COLORS = ['#d97706', '#0d9488', '#6366f1', '#94a3b8'];
