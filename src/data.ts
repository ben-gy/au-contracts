import type { Dataset } from './types';

const BASE = import.meta.env.BASE_URL || '/';

async function getJson<T>(name: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}data/${name}`, { signal });
  if (!res.ok) throw new Error(`Failed to load ${name} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

export async function loadDataset(signal?: AbortSignal): Promise<Dataset> {
  const [
    meta,
    suppliers,
    suppliersDetail,
    agencies,
    categories,
    monthly,
    largest,
    network,
    flows,
    matrix,
    consulting,
    insights,
  ] = await Promise.all([
    getJson<Dataset['meta']>('meta.json', signal),
    getJson<Dataset['suppliers']>('suppliers.json', signal),
    getJson<Dataset['suppliersDetail']>('suppliers-detail.json', signal),
    getJson<Dataset['agencies']>('agencies.json', signal),
    getJson<Dataset['categories']>('categories.json', signal),
    getJson<Dataset['monthly']>('monthly.json', signal),
    getJson<Dataset['largest']>('largest.json', signal),
    getJson<Dataset['network']>('network.json', signal),
    getJson<Dataset['flows']>('flows.json', signal),
    getJson<Dataset['matrix']>('matrix.json', signal),
    getJson<Dataset['consulting']>('consulting.json', signal),
    getJson<Dataset['insights']>('insights.json', signal),
  ]);
  return {
    meta,
    suppliers,
    suppliersDetail,
    agencies,
    categories,
    monthly,
    largest,
    network,
    flows,
    matrix,
    consulting,
    insights,
  };
}
