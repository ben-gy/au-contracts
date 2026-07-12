export interface Meta {
  generated: string;
  periodStart: string;
  periodEnd: string;
  totalValue: number;
  totalContracts: number;
  supplierCount: number;
  agencyCount: number;
  categoryCount: number;
  consultingTotal: number;
  consultingShare: number;
  fyList: { fy: string; total: number; count: number }[];
  methods: { name: string; total: number }[];
  states: { state: string; total: number; count: number }[];
}

export interface Supplier {
  slug: string;
  name: string;
  abn: string;
  state: string;
  total: number;
  count: number;
  agencies: number;
  cat: string; // top UNSPSC segment
  avg: number;
  max: number;
}

export interface NameTotal { name: string; total: number; }
export interface SegTotal { seg: string; name: string; total: number; }

export interface SupplierDetail {
  name: string;
  abn: string;
  state: string;
  total: number;
  count: number;
  avg: number;
  max: number;
  agencies: NameTotal[];
  cats: SegTotal[];
  months: { m: string; total: number }[];
}

export interface Agency {
  slug: string;
  name: string;
  total: number;
  count: number;
  avg: number;
  suppliers: number;
  topSuppliers: NameTotal[];
  cats: SegTotal[];
  months: { m: string; total: number }[];
  methods: NameTotal[];
}

export interface Category {
  seg: string;
  name: string;
  total: number;
  count: number;
  consulting: boolean;
  topSuppliers: NameTotal[];
  topAgencies: NameTotal[];
}

export interface Contract {
  id: string;
  title: string;
  amount: number;
  supplier: string;
  agency: string;
  seg: string;
  cat: string;
  signed: string;
  method: string;
  pStart: string;
  pEnd: string;
  state: string;
}

export interface NetworkData {
  suppliers: { name: string; total: number; cat: string }[];
  agencies: { name: string; total: number }[];
  edges: { s: string; a: string; total: number }[];
}

export interface FlowData {
  segments: SegTotal[];
  agencies: NameTotal[];
  links: { seg: string; agency: string; total: number }[];
}

export interface MatrixData {
  agencies: { name: string; slug: string; total: number }[];
  segments: { seg: string; name: string }[];
  cells: number[][];
}

export interface Consulting {
  total: number;
  share: number;
  byFy: { fy: string; total: number }[];
  topSuppliers: { name: string; slug: string; total: number }[];
  bigFirms: { name: string; total: number; count: number }[];
  segments: SegTotal[];
}

export interface Insight {
  severity: 'alert' | 'warn' | 'info';
  kind: string;
  title: string;
  detail: string;
  supplier?: string;
  agency?: string;
}

export interface Dataset {
  meta: Meta;
  suppliers: Supplier[];
  suppliersDetail: Record<string, SupplierDetail>;
  agencies: Agency[];
  categories: Category[];
  monthly: { m: string; total: number; count: number }[];
  largest: Contract[];
  network: NetworkData;
  flows: FlowData;
  matrix: MatrixData;
  consulting: Consulting;
  insights: Insight[];
}
