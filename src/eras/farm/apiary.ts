import { S } from '../../state/state';
import { BEE_REST, BEE_SIP, beeLoad, beeSpeed, beesPerHive, HIVE_MAX, hiveCount } from './content';
import { activeTiles, automationRests, bloomTap, fx, isRipe, plotOffset, plotSize, strainById, tileXY } from './meadow';

/**
 * Layer 2: the Apiary. Bees live in hives on the grass around the meadow. Positions are in plot
 * grid units (tile (x,y) has its centre at x+.5, y+.5), so the renderer only has to scale them.
 */

export interface Bee {
  hive: number;
  state: 'rest' | 'out' | 'sip' | 'home';
  x: number;
  y: number;
  /** Flower tile it is flying to or sipping on (-1 for none). */
  target: number;
  t: number;
  /** Honey it carries home. */
  load: number;
  /** Wobble phase, for drawing. */
  ph: number;
}

export const apiary = { bees: [] as Bee[] };

const F = () => S.farm;

/** Where hive slot k stands: the four corners first, then the middle of each side, just off the soil. */
export function hivePos(k: number): [number, number] {
  const o = plotOffset(), n = plotSize(), lo = o - .55, hi = o + n + .55, mid = o + n / 2;
  const slots: [number, number][] = [[lo, lo], [hi, lo], [lo, hi], [hi, hi], [mid, lo - .1], [hi + .1, mid], [mid, hi + .1], [lo - .1, mid]];
  return slots[k % HIVE_MAX];
}

export const hivesNow = (): number => F().apiaryOn ? hiveCount(F().hl.hives) : 0;

/** Keep one Bee per hive × colony size; new ones start at home. */
function syncBees(): void {
  const want = hivesNow() * beesPerHive(F().hl.bees);
  const per = beesPerHive(F().hl.bees);
  if (apiary.bees.length === want && apiary.bees.every((b, i) => b.hive === Math.floor(i / per))) return;
  apiary.bees = [];
  for (let i = 0; i < want; i++) {
    const hive = Math.floor(i / per), [x, y] = hivePos(hive);
    apiary.bees.push({ hive, state: 'rest', x, y, target: -1, t: Math.random() * BEE_REST, load: 0, ph: Math.random() * 6 });
  }
}

/** Nearest ripe flower to (x,y) that no other bee is heading for, of the hive's colour if it has one. */
function pickFlower(b: Bee): number {
  const pref = F().hl.waggle ? F().hivePref[b.hive] : -1;
  const taken = new Set(apiary.bees.filter(o => o !== b && o.target >= 0).map(o => o.target));
  let best = -1, bestD = Infinity;
  for (const t of activeTiles()) {
    if (taken.has(t) || !isRipe(t)) continue;
    if (pref >= 0) {
      const p = F().plot[t], s = p && strainById(p.s);
      if (!s || s.hue !== pref) continue;
    }
    const [tx, ty] = tileXY(t), d = (tx + .5 - b.x) ** 2 + (ty + .5 - b.y) ** 2;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** Move toward (tx,ty); returns true on arrival. */
function fly(b: Bee, tx: number, ty: number, dt: number): boolean {
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy), step = beeSpeed(F().hl.swift) * dt;
  if (d <= step) { b.x = tx; b.y = ty; return true; }
  b.x += dx / d * step;
  b.y += dy / d * step;
  return false;
}

/** Rolling one-minute Honey/sec. */
const rate = { bucket: 0, t: 0, hist: [] as number[] };
export const honeyRate = (): number => F().honeyRate;
export function seedHoneyRate(): void { rate.hist = new Array(60).fill(F().honeyRate); }

export function updateApiary(dt: number): void {
  syncBees();
  const f = F(), rests = automationRests();
  for (const b of apiary.bees) {
    b.ph += dt * 9;
    switch (b.state) {
      case 'rest': {
        b.t -= dt;
        if (b.t > 0 || rests) break;
        const t = pickFlower(b);
        if (t < 0) { b.t = .5; break; }
        b.target = t;
        b.state = 'out';
        break;
      }
      case 'out': {
        if (rests) { b.target = -1; b.state = 'home'; break; }
        const [tx, ty] = tileXY(b.target);
        if (!fly(b, tx + .5, ty + .3, dt)) break;
        const p = f.plot[b.target], s = p && strainById(p.s);
        if (!s || !isRipe(b.target)) {
          // someone else got there first: try the next one from here
          const next = pickFlower(b);
          if (next < 0) { b.target = -1; b.state = 'home'; } else b.target = next;
          break;
        }
        b.load = beeLoad(s.pot, f.hl.loads);
        bloomTap(b.target, true);
        b.state = 'sip';
        b.t = BEE_SIP;
        break;
      }
      case 'sip':
        b.t -= dt;
        if (b.t <= 0) { b.state = 'home'; b.target = -1; }
        break;
      case 'home': {
        const [hx, hy] = hivePos(b.hive);
        if (!fly(b, hx, hy, dt)) break;
        if (b.load > 0) {
          f.honey = Math.min(f.honey + b.load, Number.MAX_VALUE);
          f.honeyEver = Math.min(f.honeyEver + b.load, Number.MAX_VALUE);
          rate.bucket += b.load;
          fx.honey?.(b.hive, b.load);
          b.load = 0;
        }
        b.state = 'rest';
        b.t = BEE_REST;
        break;
      }
    }
  }
  rate.t += dt;
  if (rate.t >= 1) {
    rate.t -= 1;
    rate.hist.push(rate.bucket);
    rate.bucket = 0;
    if (rate.hist.length > 60) rate.hist.shift();
    f.honeyRate = rate.hist.reduce((a, c) => a + c, 0) / rate.hist.length;
  }
}

/** Time away: Honey at the stored rate × share. */
export function apiaryOffline(secs: number, share: number): number {
  const f = F();
  if (!f.apiaryOn || f.honeyRate <= 0) return 0;
  const g = f.honeyRate * secs * share;
  f.honey = Math.min(f.honey + g, Number.MAX_VALUE);
  f.honeyEver = Math.min(f.honeyEver + g, Number.MAX_VALUE);
  return g;
}

/** Bees all go home (winter). */
export function clearBees(): void { apiary.bees = []; }
