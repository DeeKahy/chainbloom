import { DU, SU } from '../content/prestige';
import type { NodeType } from '../content/types';
import { UP } from '../content/upgrades';
import { SL } from '../content/singularity';

export const SAVE_VERSION = 4;

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
  autoCol: boolean;
  /** Seconds since the last Collapse, for Auto-Collapse. */
  colTime: number;
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
    sing: 0, singEver: 0, singularities: 0, sl: levels(SL), cyclePeak: 0, autoCol: false, colTime: 0,
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
  for (const m of [S.lv, S.st, S.dl, S.sl]) for (const k of Object.keys(m)) fix(m, k);
  for (const n of S.board) fix(n as unknown as Record<string, unknown>, 'c');
  return ok;
}
