import { S } from '../../state/state';
import {
  bloomValue, genome, growTime, HUES, hybridChance, jellyMult, mutationChance, PATTERNS, patternOf, soilMult,
  PLOT_BASE, PLOT_MAX, POLLEN_BOOST, POLLEN_SPEED, potMax, type Strain,
} from './content';

/**
 * The meadow simulation. DOM-free: it reports what happened through `fx`, which the renderer and
 * UI fill in. Tiles are indices into S.farm.plot (PLOT_MAX × PLOT_MAX, row-major).
 */

export interface Chain {
  /** Blooms so far, and Pollen paid. */
  count: number;
  pay: number;
  /** Started by a bee rather than a tap (counts toward the offline rate). */
  auto: boolean;
  /** Pollen grains of this chain still in the air. */
  live: number;
  /** Tile it started on. */
  origin: number;
  /** The harvest chain (layer 3): every flower it blooms is brought in. */
  harvest: boolean;
  /** Sum of the potencies of the flowers a harvest chain brought in (each tile once). */
  crops: number;
  /** Tiles a harvest chain has counted, and the time (s) since it last counted a new one. */
  reaped: Set<number>;
  idle: number;
  /** Set when the harvest is brought in while the chain still runs: it no longer counts. */
  closed: boolean;
  /** Grains of this chain in the air, by target tile (for merging). */
  inbound: Map<number, Grain>;
  /** Tiles that already bloomed in this chain: each flower blooms at most once per chain, so chains end. */
  done: Set<number>;
}

export interface Grain {
  from: number;
  to: number;
  /** Seconds in the air so far, and the whole flight. */
  t: number;
  dur: number;
  chain: Chain;
  /** Depth of the bloom that sent it. */
  depth: number;
  /** Strain that sent it. */
  strain: number;
  /** Grains merged into this one (see GRAIN_MERGE): it carries their growth too. */
  w: number;
}

/** Above this many grains in the air, a new grain joins one of its chain already flying to the same tile. */
export const GRAIN_MERGE = 200;

export const meadow = {
  grains: [] as Grain[],
  /** Layer 3: 'armed' = the next tap starts the harvest chain; 'running' = it is under way. */
  harvest: 'off' as 'off' | 'armed' | 'running',
  harvestChain: null as Chain | null,
};

/** Seconds a harvest chain may go without reaching a new flower before the harvest is brought in. */
export const HARVEST_IDLE = 15;

/**
 * Bring the harvest in: when its chain dies out, after HARVEST_IDLE, or when the player says so.
 * A looping chain keeps running (and paying Pollen) afterwards; it just stops counting crops.
 */
export function bringIn(c: Chain | null = meadow.harvestChain): void {
  if (!c || c.closed) return;
  c.closed = true;
  meadow.harvestChain = null;
  fx.harvestEnd?.(c);
}

/** While a harvest is being set up or brought in, the bees rest. */
export const automationRests = (): boolean => meadow.harvest !== 'off';

/** Pollen multiplier from the layers above the Meadow. */
export const pollenMult = (): number => jellyMult(F().hl.jelly) * soilMult(F().hv.soil);

/** Effects for the renderer and UI. Every hook is optional. */
export const fx: {
  bloom?: (tile: number, depth: number, pay: number, s: Strain, kindred: boolean) => void;
  chainEnd?: (c: Chain) => void;
  hybrid?: (s: Strain, tile: number) => void;
  reap?: (tile: number) => void;
  harvestEnd?: (c: Chain) => void;
  honey?: (hive: number, amount: number) => void;
  grow?: (tile: number) => void;
} = {};

const F = () => S.farm;

// ---------- the plot ----------

export const plotSize = (): number => PLOT_BASE + F().lv.plot;
/** First row/column of the plot in use: it grows outward from the middle. */
export const plotOffset = (): number => Math.floor((PLOT_MAX - plotSize()) / 2);
export const tileXY = (i: number): [number, number] => [i % PLOT_MAX, Math.floor(i / PLOT_MAX)];
export const tileAt = (x: number, y: number): number => y * PLOT_MAX + x;

export function inPlot(x: number, y: number): boolean {
  const o = plotOffset(), n = plotSize();
  return x >= o && y >= o && x < o + n && y < o + n;
}

export function activeTiles(): number[] {
  const o = plotOffset(), n = plotSize(), out: number[] = [];
  for (let y = o; y < o + n; y++) for (let x = o; x < o + n; x++) out.push(tileAt(x, y));
  return out;
}

const strainCache = new Map<number, Strain>();
let strainVer = '';
export function strainById(id: number): Strain | undefined {
  const ver = F().strains.length + ':' + F().next;
  if (ver !== strainVer) {
    strainVer = ver;
    strainCache.clear();
    for (const s of F().strains) strainCache.set(s.id, s);
  }
  return strainCache.get(id);
}

export const isRipe = (i: number): boolean => { const p = F().plot[i]; return !!p && p.g >= 1; };

/** Plant (or replace) on a tile. Returns false if nothing changed. */
export function plant(i: number, strain: number): boolean {
  const [x, y] = tileXY(i);
  if (!inPlot(x, y) || !strainById(strain)) return false;
  const p = F().plot[i];
  if (p && p.s === strain) return false;
  F().plot[i] = { s: strain, g: 0 };
  return true;
}

export function uproot(i: number): boolean {
  if (!F().plot[i]) return false;
  F().plot[i] = null;
  return true;
}

/** Tiles the pollen of a bloom on tile i goes to. */
export function targetsOf(i: number, s: Strain): number[] {
  const pat = patternOf(s.p), [x, y] = tileXY(i);
  if (pat.id === 'wind') {
    const pool = activeTiles().filter(t => t !== i);
    const out: number[] = [];
    for (let k = 0; k < 3 && pool.length; k++) out.push(pool.splice(Math.random() * pool.length | 0, 1)[0]);
    return out;
  }
  if (pat.id === 'seek') {
    return activeTiles()
      .filter(t => t !== i && isRipe(t))
      .map(t => { const [tx, ty] = tileXY(t); return [t, (tx - x) ** 2 + (ty - y) ** 2]; })
      .sort((a, b) => a[1] - b[1]).slice(0, 2).map(a => a[0]);
  }
  const out: number[] = [];
  for (const [dx, dy] of pat.reach) if (inPlot(x + dx, y + dy)) out.push(tileAt(x + dx, y + dy));
  return out;
}

// ---------- blooming ----------

function bloom(i: number, chain: Chain, depth: number, kindred: boolean): void {
  const f = F(), p = f.plot[i];
  if (!p || p.g < 1 || chain.done.has(i)) return;
  const s = strainById(p.s);
  if (!s) return;
  chain.done.add(i);
  p.g = 0;
  const v = bloomValue(s, depth, kindred, f.lv.nectar, f.lv.scent, pollenMult());
  f.pollen = Math.min(f.pollen + v, Number.MAX_VALUE);
  f.pollenEver = Math.min(f.pollenEver + v, Number.MAX_VALUE);
  f.yearPollen = Math.min(f.yearPollen + v, Number.MAX_VALUE);
  if (chain.harvest && !chain.closed && !chain.reaped.has(i)) { chain.reaped.add(i); chain.crops += s.pot; chain.idle = 0; fx.reap?.(i); }
  f.blooms++;
  chain.count++;
  chain.pay += v;
  if (chain.auto) rate.bucket += v;
  fx.bloom?.(i, depth, v, s, kindred);
  const [x, y] = tileXY(i);
  for (const t of targetsOf(i, s)) {
    const [tx, ty] = tileXY(t);
    const far = Math.hypot(tx - x, ty - y);
    const slow = s.p === 'wind' || s.p === 'seek' ? .6 : 1;
    // An endless chain would otherwise fill the air with grains: past GRAIN_MERGE, join one already going there.
    const twin = meadow.grains.length > GRAIN_MERGE ? chain.inbound.get(t) : undefined;
    if (twin) { twin.w++; continue; }
    const g: Grain = { from: i, to: t, t: 0, dur: .14 + POLLEN_SPEED * far / slow, chain, depth, strain: s.id, w: 1 };
    meadow.grains.push(g);
    chain.inbound.set(t, g);
    chain.live++;
  }
}

/** A tap on a ripe flower (or a bee). Returns false if it wasn't ripe. */
export function bloomTap(i: number, auto = false): boolean {
  if (!isRipe(i)) return false;
  const harvest = !auto && meadow.harvest === 'armed';
  if (harvest) meadow.harvest = 'running';
  const chain: Chain = { count: 0, pay: 0, auto, live: 0, origin: i, harvest, crops: 0, reaped: new Set(), idle: 0, closed: false, inbound: new Map(), done: new Set() };
  if (harvest) meadow.harvestChain = chain;
  bloom(i, chain, 0, false);
  if (!chain.live) endChain(chain);
  return true;
}

function endChain(c: Chain): void {
  const f = F();
  if (c.count > f.bestChain) f.bestChain = c.count;
  if (c.pay > f.bestPay) f.bestPay = c.pay;
  fx.chainEnd?.(c);
  if (c.harvest) bringIn(c);
}

function land(g: Grain): void {
  const f = F(), p = f.plot[g.to];
  if (g.chain.inbound.get(g.to) === g) g.chain.inbound.delete(g.to);
  if (p) {
    const target = strainById(p.s), from = strainById(g.strain);
    if (p.g >= 1 && target && !g.chain.done.has(g.to)) {
      if (from && from.id !== target.id && Math.random() < hybridChance(f.lv.wild)) discover(breed(from, target), g.to);
      bloom(g.to, g.chain, g.depth + 1, !!from && from.hue === target.hue);
    } else if (p.g < 1 && !g.chain.done.has(g.to)) {
      // a flower this chain already bloomed doesn't regrow from it: chains always end
      p.g = Math.min(1, p.g + POLLEN_BOOST * g.w);
      fx.grow?.(g.to);
    }
  }
  if (--g.chain.live <= 0) endChain(g.chain);
}

// ---------- breeding ----------

const pick = <T,>(a: T, b: T): T => Math.random() < .5 ? a : b;

export function breed(a: Strain, b: Strain): Omit<Strain, 'id'> {
  const f = F(), cap = potMax(f.lv.vigour);
  const child = { p: pick(a.p, b.p), hue: pick(a.hue, b.hue), pot: Math.min(cap, Math.max(a.pot, b.pot)) };
  if (Math.random() < mutationChance(f.lv.wild)) {
    const r = Math.random();
    if (r < .4 && child.pot < cap) child.pot++;
    else if (r < .7) {
      const others = PATTERNS.filter(p => p.id !== child.p);
      child.p = others[Math.random() * others.length | 0].id;
    } else child.hue = (child.hue + 1 + (Math.random() * (HUES.length - 1) | 0)) % HUES.length;
  }
  return child;
}

/** Add a bred strain if it is new. */
function discover(g: Omit<Strain, 'id'>, tile: number): void {
  const f = F(), key = genome(g);
  if (f.strains.some(s => genome(s) === key)) return;
  const s: Strain = { ...g, id: f.next++ };
  f.strains.push(s);
  f.hybrids++;
  if (s.pot > f.potBest) f.potBest = s.pot;
  fx.hybrid?.(s, tile);
}

/** Throw a strain on the compost: its flowers come up too. The last strain can't go. */
export function compost(id: number): boolean {
  const f = F();
  if (f.strains.length <= 1) return false;
  f.strains = f.strains.filter(s => s.id !== id);
  f.plot = f.plot.map(p => p && p.s === id ? null : p);
  if (f.sel === id) f.sel = f.strains[0].id;
  return true;
}

// ---------- time ----------

/** Rolling one-minute average of Pollen/sec from chains the bees start (trips are slow, so 5 s is too short). */
const rate = { bucket: 0, t: 0, hist: [] as number[], avg: 0 };
export const autoRate = (): number => rate.avg;
/** Start the average from the rate stored with the save, so a save right after loading keeps it. */
export function seedRate(v: number): void {
  rate.hist = new Array(60).fill(v);
  rate.avg = v;
}

export function grow(i: number, secs: number): void {
  const p = F().plot[i];
  if (!p || p.g >= 1) return;
  const s = strainById(p.s);
  if (s) p.g = Math.min(1, p.g + secs / growTime(s, F().lv.sun, F().hv.spring));
}

export function update(dt: number): void {
  const f = F();
  f.playTime += dt;
  for (const i of activeTiles()) grow(i, dt);

  const hc = meadow.harvestChain;
  if (hc && (hc.idle += dt) > HARVEST_IDLE) bringIn(hc);

  for (let k = meadow.grains.length - 1; k >= 0; k--) {
    const g = meadow.grains[k];
    g.t += dt;
    if (g.t < g.dur) continue;
    meadow.grains.splice(k, 1);
    land(g);
  }

  rate.t += dt;
  if (rate.t >= 1) {
    rate.t -= 1;
    rate.hist.push(rate.bucket);
    rate.bucket = 0;
    if (rate.hist.length > 60) rate.hist.shift();
    rate.avg = rate.hist.reduce((a, b) => a + b, 0) / rate.hist.length;
  }
}

/** Time the game did not run: flowers grow, and the bees' chains earn at their measured rate × share. */
export function offline(secs: number, share: number): number {
  for (const i of activeTiles()) grow(i, secs);
  if (!F().apiaryOn || S.lastRate <= 0) return 0;
  const g = S.lastRate * secs * share;
  F().pollen = Math.min(F().pollen + g, Number.MAX_VALUE);
  F().pollenEver = Math.min(F().pollenEver + g, Number.MAX_VALUE);
  return g;
}
