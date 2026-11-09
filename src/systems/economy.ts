import { app, clock } from '../core/app';
import type { RunUpgradeDef, UpgradeDef } from '../content/types';
import { UP } from '../content/upgrades';
import { DU, SU } from '../content/prestige';
import { S } from '../state/state';
import { recalc, stat } from './stats';

/** A chain of pops started by one detonation; tracks its payout for the floating text. */
export interface Chain {
  x: number;
  y: number;
  total: number;
  count: number;
  last: number;
  maxD: number;
  /** Started by a drone or Instability rather than a click. Used for offline earnings. */
  auto: boolean;
  over?: boolean;
  /** Universe it started in, and pops it made in the other universe (layer 5: Threads come from these). */
  home: number;
  cross: number;
  /** Times a blast of this chain went through the bridge. */
  hops: number;
  /** Garden beds this chain already made bloom: each flower blooms at most once per chain, so chains end. */
  bloomed?: object[];
  /** Melody: colours of the latest normal orbs popped, and whether they matched the target. */
  notes: string;
  sang: boolean;
}

/** Rolling 5-second money/sec averages: all income, and income from automation only. */
const rate = { bucket: 0, autoBucket: 0, hist: [] as number[], autoHist: [] as number[], t: 0, avg: 0, autoAvg: 0 };

export const rateAvg = (): number => rate.avg;
export const autoRateAvg = (): number => rate.autoAvg;

export function earn(v: number, ch: Chain | null): void {
  // Capped at the largest double so it never becomes Infinity (see sanitizeState).
  S.money = Math.min(S.money + v, Number.MAX_VALUE);
  S.runEarned = Math.min(S.runEarned + v, Number.MAX_VALUE);
  S.total = Math.min(S.total + v, Number.MAX_VALUE);
  rate.bucket += v;
  if (ch) {
    if (ch.auto) rate.autoBucket += v;
    ch.total += v;
    ch.count++;
    ch.last = clock.T;
  }
}

const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;

export function tickRate(dt: number): void {
  rate.t += dt;
  if (rate.t < 1) return;
  rate.t -= 1;
  rate.hist.push(rate.bucket);
  rate.autoHist.push(rate.autoBucket);
  rate.bucket = rate.autoBucket = 0;
  if (rate.hist.length > 5) { rate.hist.shift(); rate.autoHist.shift(); }
  rate.avg = avg(rate.hist);
  rate.autoAvg = avg(rate.autoHist);
}

// ---------- level-based upgrade costs ----------

/** Cost of the next single level of an upgrade. */
export const levelCost = (u: UpgradeDef, l: number): number => u.base * u.g ** l;

export const isVisible = (u: RunUpgradeDef): boolean =>
  !u.unlock || S.seen.includes(u.id) || u.unlock(S, stat);

/** How many levels the current Buy setting would purchase, and their total cost. */
export function costFor(u: UpgradeDef, l: number, money: number): [count: number, cost: number] {
  if (l >= u.max) return [0, 0];
  if (app.buyN === 'max') {
    let n = 0, c = 0;
    while (l + n < u.max && n < 500) {
      const nx = levelCost(u, l + n);
      if (c + nx > money) break;
      c += nx;
      n++;
    }
    if (n === 0) return [1, levelCost(u, l)];
    return [n, c];
  }
  const n = Math.min(+app.buyN, u.max - l);
  return [n, u.base * u.g ** l * (u.g ** n - 1) / (u.g - 1)];
}

/** Buy using the current Buy setting. Returns true if anything was bought. */
export function buyRunUpgrade(u: RunUpgradeDef): boolean {
  const l = S.lv[u.id];
  if (!isVisible(u) || l >= u.max) return false;
  const [n, c] = costFor(u, l, S.money);
  if (S.money < c || n < 1) return false;
  S.money -= c;
  S.lv[u.id] += n;
  recalc();
  return true;
}

/** Dark Matter Autobuyer: repeatedly buys the cheapest visible run upgrade. */
export function autoBuy(): void {
  for (let i = 0; i < 40; i++) {
    let best: RunUpgradeDef | null = null, bc = Infinity;
    for (const u of UP) {
      const l = S.lv[u.id];
      if (l >= u.max || !isVisible(u)) continue;
      const c = levelCost(u, l);
      if (c < bc) { bc = c; best = u; }
    }
    if (!best || S.money < bc) break;
    S.money -= bc;
    S.lv[best.id]++;
    recalc();
  }
}

/** Stardust Autobuyer (Singularity upgrade): repeatedly buys the cheapest Stardust upgrade. */
export function autoBuyStardust(): void {
  for (let i = 0; i < 40; i++) {
    let best: UpgradeDef | null = null, bc = Infinity;
    for (const u of SU) {
      const l = S.st[u.id];
      if (l >= u.max) continue;
      const c = Math.ceil(u.base * u.g ** l);
      if (c < bc) { bc = c; best = u; }
    }
    if (!best || S.stardust < bc) break;
    S.stardust -= bc;
    S.st[best.id]++;
    recalc();
  }
}

/** Dark Matter Autobuyer (Multiverse upgrade): repeatedly buys the cheapest Dark Matter upgrade. */
export function autoBuyDark(): void {
  for (let i = 0; i < 40; i++) {
    let best: UpgradeDef | null = null, bc = Infinity;
    for (const u of DU) {
      const l = S.dl[u.id];
      if (l >= u.max) continue;
      const c = Math.ceil(u.base * u.g ** l);
      if (c < bc) { bc = c; best = u; }
    }
    if (!best || S.dm < bc) break;
    S.dm -= bc;
    S.dl[best.id]++;
    recalc();
  }
}
