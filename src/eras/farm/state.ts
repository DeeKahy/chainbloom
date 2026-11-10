import { FL, PLOT_MAX, STARTER_STRAINS, type Strain } from './content';

/** A flower on the plot: which strain, and how grown it is (1 = ripe). */
export interface Plant { s: number; g: number }

/** The farm era's part of the save (`S.farm`). */
export interface FarmState {
  pollen: number;
  pollenEver: number;
  lv: Record<string, number>;
  strains: Strain[];
  /** Next strain id. */
  next: number;
  /** Strain the next tap on empty soil plants. */
  sel: number;
  /** PLOT_MAX² tiles, row-major; null is bare soil. */
  plot: (Plant | null)[];
  blooms: number;
  /** Most blooms in one chain, and most Pollen one chain paid. */
  bestChain: number;
  bestPay: number;
  hybrids: number;
  potBest: number;
  /** Date.now() when you became a farmer. */
  since: number;
  playTime: number;
}

export function freshFarm(): FarmState {
  const strains = STARTER_STRAINS.map((s, i) => ({ ...s, id: i + 1 }));
  return {
    pollen: 0, pollenEver: 0, lv: Object.fromEntries(FL.map(u => [u.id, 0])),
    strains, next: strains.length + 1, sel: 1,
    plot: new Array(PLOT_MAX * PLOT_MAX).fill(null),
    blooms: 0, bestChain: 0, bestPay: 0, hybrids: 0, potBest: 1, since: 0, playTime: 0,
  };
}

/** Repair a loaded farm slice: fill new fields and upgrades, drop broken tiles. */
export function normalizeFarm(raw: unknown): FarmState {
  const f = freshFarm();
  if (!raw || typeof raw !== 'object') return f;
  const d = raw as Partial<FarmState>;
  const out: FarmState = Object.assign(f, d);
  out.lv = Object.assign(freshFarm().lv, d.lv);
  if (!Array.isArray(out.strains) || !out.strains.length) out.strains = freshFarm().strains;
  const ids = new Set(out.strains.map(s => s.id));
  if (!Array.isArray(out.plot) || out.plot.length !== PLOT_MAX * PLOT_MAX) out.plot = freshFarm().plot;
  out.plot = out.plot.map(p => p && ids.has(p.s) && typeof p.g === 'number' ? p : null);
  if (!ids.has(out.sel)) out.sel = out.strains[0].id;
  return out;
}
