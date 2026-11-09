import { DU, SU } from '../content/prestige';
import type { NodeType } from '../content/types';
import { UP } from '../content/upgrades';
import { SL } from '../content/singularity';
import { TL } from '../content/multiverse';
import { GL, type Bed, type Seed } from '../content/garden';
import { LL, LOOM_MAX } from '../content/loom';
import { EL } from '../content/bang';

export const SAVE_VERSION = 8;

export interface BoardNode {
  q: number;
  r: number;
  t: NodeType;
  /** Flux paid for it (refunded on removal). */
  c: number;
  flash?: number;
}

/** Everything that persists in the save. Transient simulation state lives in sim/world.ts. */
export interface GameState {
  version: number;
  // layer 1: money
  money: number;
  runEarned: number;
  total: number;
  lv: Record<string, number>;
  seen: string[];
  runTime: number;
  // layer 2: stardust
  stardust: number;
  starsEver: number;
  starsCycle: number;
  st: Record<string, number>;
  novas: number;
  autoNova: boolean;
  // layer 3: dark matter, constellation, rifts
  dm: number;
  dmEver: number;
  collapses: number;
  dl: Record<string, number>;
  board: BoardNode[];
  flux: number;
  fluxEver: number;
  pulseBank: number;
  rift: number;
  riftsDone: number[];
  autoBuy: boolean;
  // layer 4: singularity
  sing: number;
  singEver: number;
  singularities: number;
  sl: Record<string, number>;
  /** Highest runEarned since the last Singularity (all time before the first). Sets the gain. */
  cyclePeak: number;
  /** Stardust Autobuyer toggle (Singularity upgrade). */
  autoStar: boolean;
  autoCol: boolean;
  // layer 5: multiverse
  threads: number;
  threadsEver: number;
  multiverses: number;
  tl: Record<string, number>;
  /** Most pops a single chain made in the other universe this cycle. Sets the Thread gain. */
  crossBest: number;
  /** All pops chains made in the other universe this cycle. Threads flow in live from it. */
  crossTotal: number;
  /** Threads already paid out live this cycle from crossTotal. */
  threadsLive: number;
  /** Law of Physics chosen for universe A and B ('' = none). */
  laws: string[];
  /** Melody target: five digits, each a normal orb colour (0-2). */
  melody: string;
  autoDm: boolean;
  /** Seconds since the last Collapse, for Auto-Collapse. */
  colTime: number;
  /** Seconds since the last Multiverse, for Auto-Multiverse. */
  mvTime: number;
  /** Most times one chain went through the bridge (the Garden needs 3). */
  hopBest: number;
  // layer 6: garden
  gardenOn: boolean;
  garden: { seeds: Seed[]; beds: Bed[]; next: number };
  pollen: number;
  pollenEver: number;
  gl: Record<string, number>;
  /** Crosses since the last Big Bang (sets the cross cost). */
  crosses: number;
  /** Highest seed potency ever bred (the Loom needs 4). */
  potBest: number;
  autoMv: boolean;
  // layer 7: loom
  loomOn: boolean;
  /** LOOM_MAX² cells, row-major: 0 empty, else a bead's tier. */
  loom: number[];
  knots: number;
  knotsEver: number;
  ll: Record<string, number>;
  bestBead: number;
  autoMerge: boolean;
  // layer 8: big bang
  bangOn: boolean;
  eras: number;
  erasEver: number;
  bangs: number;
  el: Record<string, number>;
  /** The Stillness: nothing detonates while the field fills up for a Big Bang. */
  gathering: boolean;
  // bookkeeping
  popped: number;
  best: number;
  saved: number;
  /** Average money/sec from automated sources at last save, used for offline earnings. */
  lastRate: number;
  mute: boolean;
  /** Stats-pane rows pinned to the orb field, by row id. */
  pinned: string[];
  playTime: number;
}

const levels = (defs: { id: string }[]): Record<string, number> =>
  Object.fromEntries(defs.map(d => [d.id, 0]));

export function fresh(): GameState {
  return {
    version: SAVE_VERSION,
    money: 0, runEarned: 0, total: 0, lv: levels(UP), seen: [], runTime: 0,
    stardust: 0, starsEver: 0, starsCycle: 0, st: levels(SU), novas: 0, autoNova: false,
    dm: 0, dmEver: 0, collapses: 0, dl: levels(DU), board: [], flux: 0, fluxEver: 0, pulseBank: 0,
    rift: 0, riftsDone: [], autoBuy: true,
    sing: 0, singEver: 0, singularities: 0, sl: levels(SL), cyclePeak: 0, autoStar: true, autoCol: false, colTime: 0,
    threads: 0, threadsEver: 0, multiverses: 0, tl: levels(TL), crossBest: 0, crossTotal: 0, threadsLive: 0, laws: ['', ''], melody: '01201', autoDm: true, mvTime: 0, hopBest: 0,
    gardenOn: false, garden: { seeds: [], beds: [], next: 1 }, pollen: 0, pollenEver: 0, gl: levels(GL), crosses: 0, potBest: 0, autoMv: true,
    loomOn: false, loom: new Array(LOOM_MAX * LOOM_MAX).fill(0), knots: 0, knotsEver: 0, ll: levels(LL), bestBead: 0, autoMerge: true,
    bangOn: false, eras: 0, erasEver: 0, bangs: 0, el: levels(EL), gathering: false,
    popped: 0, best: 0, saved: 0, lastRate: 0, mute: false, pinned: [], playTime: 0,
  };
}

/** The one live game state. Its identity never changes, so modules can import it directly. */
export const S: GameState = fresh();

/** Swap in a whole new state (load, import, wipe) without breaking references to S. */
export function replaceState(next: GameState): void {
  for (const k of Object.keys(S)) delete (S as unknown as Record<string, unknown>)[k];
  Object.assign(S, next);
}

/**
 * Plain doubles overflow to Infinity past ~1.8e308, and JSON writes Infinity as null, which would
 * load back as 0 and wipe progress. Clamp every saved number to the largest finite double instead.
 * Returns false if any value is NaN; the caller must not write the save then.
 */
export function sanitizeState(): boolean {
  let ok = true;
  const fix = (o: Record<string, unknown>, k: string): void => {
    const v = o[k];
    if (typeof v !== 'number') return;
    if (Number.isNaN(v)) ok = false;
    else if (v === Infinity) o[k] = Number.MAX_VALUE;
    else if (v === -Infinity) o[k] = -Number.MAX_VALUE;
  };
  const top = S as unknown as Record<string, unknown>;
  for (const k of Object.keys(top)) fix(top, k);
  for (const m of [S.lv, S.st, S.dl, S.sl, S.tl, S.gl, S.ll, S.el]) for (const k of Object.keys(m)) fix(m, k);
  for (const n of S.board) fix(n as unknown as Record<string, unknown>, 'c');
  return ok;
}
