import { FL, HIVE_MAX, HL, HV, PLOT_MAX, STARTER_STRAINS, type Strain } from './content';

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
  // layer 2: the Apiary
  apiaryOn: boolean;
  honey: number;
  honeyEver: number;
  hl: Record<string, number>;
  /** Favourite colour of each hive slot (-1 = any), used once Waggle Dance is owned. */
  hivePref: number[];
  /** One-minute average Honey/sec, stored for time away. */
  honeyRate: number;
  // layer 3: the Seasons
  seasonsOn: boolean;
  /** Harvest 🌾 held, and ever. */
  sheaves: number;
  sheavesEver: number;
  hv: Record<string, number>;
  harvests: number;
  /** Pollen earned since the last harvest (sets prosperity). */
  yearPollen: number;
  bestHarvest: number;
}

export function freshFarm(): FarmState {
  const strains = STARTER_STRAINS.map((s, i) => ({ ...s, id: i + 1 }));
  return {
    pollen: 0, pollenEver: 0, lv: Object.fromEntries(FL.map(u => [u.id, 0])),
    strains, next: strains.length + 1, sel: 1,
    plot: new Array(PLOT_MAX * PLOT_MAX).fill(null),
    blooms: 0, bestChain: 0, bestPay: 0, hybrids: 0, potBest: 1, since: 0, playTime: 0,
    apiaryOn: false, honey: 0, honeyEver: 0, hl: Object.fromEntries(HL.map(u => [u.id, 0])), hivePref: new Array(HIVE_MAX).fill(-1), honeyRate: 0,
    seasonsOn: false, sheaves: 0, sheavesEver: 0, hv: Object.fromEntries(HV.map(u => [u.id, 0])), harvests: 0, yearPollen: 0, bestHarvest: 0,
  };
}

/** Repair a loaded farm slice: fill new fields and upgrades, drop broken tiles. */
export function normalizeFarm(raw: unknown): FarmState {
  const f = freshFarm();
  if (!raw || typeof raw !== 'object') return f;
  const d = raw as Partial<FarmState>;
  const out: FarmState = Object.assign(f, d);
  out.lv = Object.assign(freshFarm().lv, d.lv);
  out.hl = Object.assign(freshFarm().hl, d.hl);
  out.hv = Object.assign(freshFarm().hv, d.hv);
  if (!Array.isArray(out.hivePref) || out.hivePref.length !== HIVE_MAX) out.hivePref = freshFarm().hivePref;
  // farms from before the Seasons: their first year started when they did
  if (typeof d.yearPollen !== 'number') out.yearPollen = out.pollenEver;
  if (!Array.isArray(out.strains) || !out.strains.length) out.strains = freshFarm().strains;
  const ids = new Set(out.strains.map(s => s.id));
  if (!Array.isArray(out.plot) || out.plot.length !== PLOT_MAX * PLOT_MAX) out.plot = freshFarm().plot;
  out.plot = out.plot.map(p => p && ids.has(p.s) && typeof p.g === 'number' ? p : null);
  if (!ids.has(out.sel)) out.sel = out.strains[0].id;
  return out;
}
