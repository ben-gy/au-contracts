// Leaflet choropleth of supplier contract value by state/territory.
// Uses real ABS-derived GeoJSON boundaries (never hand-drawn paths).
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StateRow } from './types.ts';
import { money, moneyFull, num } from './format.ts';
import { el } from './dom.ts';

interface GeoFeature {
  type: 'Feature';
  properties: { code: string; name: string };
  geometry: unknown;
}

let cachedGeo: { type: string; features: GeoFeature[] } | null = null;

async function loadGeo(): Promise<{ type: string; features: GeoFeature[] }> {
  if (cachedGeo) return cachedGeo;
  const res = await fetch('data/au-states.geojson');
  if (!res.ok) throw new Error('Failed to load map boundaries');
  cachedGeo = await res.json();
  return cachedGeo!;
}

function colorFor(value: number, max: number): string {
  if (value <= 0) return '#e2e8f0';
  const t = Math.sqrt(value / max);
  // interpolate light teal → deep navy
  const stops = [
    [224, 242, 241], // #e0f2f1
    [77, 182, 172],  // #4db6ac
    [13, 148, 136],  // #0d9488
    [15, 45, 74],    // #0f2d4a
  ];
  const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const localT = t * (stops.length - 1) - seg;
  const a = stops[seg], b = stops[seg + 1];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * localT));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export async function renderMap(container: HTMLElement, states: StateRow[]): Promise<void> {
  const byCode = new Map<string, StateRow>();
  for (const s of states) byCode.set(s.state, s);
  const max = Math.max(1, ...states.filter((s) => s.state !== 'Overseas' && s.state !== 'Unknown').map((s) => s.value));

  const mapDiv = el('div', { class: 'map-canvas' });
  container.append(mapDiv);

  const info = el('div', { class: 'map-info' }, ['Hover a state for its total']);
  container.append(info);

  // Load boundaries, then wait two animation frames so the flex layout has
  // given the container a real width before Leaflet measures it (otherwise the
  // SVG renderer caches a zero-width viewport and nothing draws).
  const geo = await loadGeo();
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const AUS_BOUNDS = L.latLngBounds([-44, 112], [-10, 154]);
  const map = L.map(mapDiv, {
    scrollWheelZoom: false,
    attributionControl: false,
    zoomControl: true,
  });
  map.invalidateSize(false);
  map.fitBounds(AUS_BOUNDS, { padding: [8, 8] });

  L.geoJSON(geo as unknown as GeoJSON.GeoJsonObject, {
    style: (feature) => {
      const code = (feature?.properties as { code: string }).code;
      const row = byCode.get(code);
      return {
        fillColor: colorFor(row?.value ?? 0, max),
        weight: 1,
        color: '#ffffff',
        fillOpacity: 0.9,
      };
    },
    onEachFeature: (feature, lyr) => {
      const props = feature.properties as { code: string; name: string };
      const row = byCode.get(props.code);
      const html = `<strong>${props.name}</strong><br>${row ? moneyFull(row.value) : 'No data'}${row ? ` · ${num(row.count)} contracts` : ''}`;
      lyr.on('mouseover', () => {
        (lyr as L.Path).setStyle({ weight: 2.5, color: '#0f2d4a', fillOpacity: 1 });
        info.innerHTML = html;
      });
      lyr.on('mouseout', () => {
        (lyr as L.Path).setStyle({ weight: 1, color: '#ffffff', fillOpacity: 0.9 });
        info.innerHTML = 'Hover a state for its total';
      });
      lyr.bindTooltip(html, { sticky: true });
    },
  }).addTo(map);

  // Re-measure once more after paint in case the container was still settling.
  const settle = () => {
    map.invalidateSize(false);
    map.fitBounds(AUS_BOUNDS, { padding: [8, 8] });
  };
  requestAnimationFrame(settle);
  setTimeout(settle, 300);

  // Legend
  const legend = el('div', { class: 'map-legend' });
  legend.append(el('div', { class: 'map-legend-title' }, ['Supplier value']));
  const scale = el('div', { class: 'map-legend-scale' });
  for (let i = 0; i <= 4; i++) {
    const v = max * Math.pow(i / 4, 2);
    const cell = el('div', { class: 'map-legend-cell' }, [i === 0 ? '$0' : money(v)]);
    cell.style.background = colorFor(v, max);
    if (i >= 3) cell.style.color = '#fff';
    scale.append(cell);
  }
  legend.append(scale);
  container.append(legend);

  // Overseas / unknown callout (not on the map)
  const off = states.filter((s) => s.state === 'Overseas' || s.state === 'Unknown').filter((s) => s.value > 0);
  if (off.length) {
    const note = el('div', { class: 'map-offshore' });
    note.append(el('strong', {}, ['Not shown on map: ']));
    note.append(document.createTextNode(off.map((s) => `${s.state} ${money(s.value)}`).join(' · ')));
    container.append(note);
  }
}
