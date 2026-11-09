import { soundOn, tone } from '../audio';
import { clock } from '../core/app';
import { BEAD_MIN, beadTier, knotsFor, LOOM_MAX } from '../content/loom';
import { hooks } from '../sim/world';
import { S } from '../state/state';
import type { Chain } from './economy';
import { recalc, stat } from './stats';

/**
 * Layer 7: the Loom's rules. Cells are S.loom (LOOM_MAX wide, row-major); only the top-left
 * stat.loomSize × stat.loomSize square is in use.
 */

/** Indices of the cells in use. */
export function loomCells(): number[] {
  const out: number[] = [];
  for (let r = 0; r < stat.loomSize; r++) for (let c = 0; c < stat.loomSize; c++) out.push(r * LOOM_MAX + c);
  return out;
}

/** Set by the Loom pane: flash a cell when a bead lands or merges there. */
export const loomFx = { landed: -1, merged: -1 };

let lastDrop = 0;

/** A finished chain of BEAD_MIN+ pops drops a bead on a random empty cell (at most ~2 per second). */
function dropBead(c: Chain): void {
  if (!S.loomOn || c.count < BEAD_MIN || clock.T - lastDrop < .5) return;
  lastDrop = clock.T;
  const empty = loomCells().filter(i => !S.loom[i]);
  if (!empty.length) return;
  const i = empty[Math.random() * empty.length | 0];
  S.loom[i] = beadTier(c.count) + (Math.random() < stat.heavy ? 1 : 0);
  if (S.loom[i] > S.bestBead) S.bestBead = S.loom[i];
  loomFx.landed = i;
  recalc();
}
hooks.bead = dropBead;

/** Merge the bead at `from` into the one at `to` (same tier): `to` goes up a tier. Returns success. */
export function merge(from: number, to: number): boolean {
  const t = S.loom[from];
  if (from === to || !t || S.loom[to] !== t) return false;
  S.loom[from] = 0;
  S.loom[to] = t + 1;
  if (t + 1 > S.bestBead) S.bestBead = t + 1;
  const k = knotsFor(t + 1);
  S.knots += k; S.knotsEver += k;
  loomFx.merged = to;
  recalc();
  if (soundOn()) tone(392 * 1.122 ** Math.min(t, 16), .25, .05, 'triangle', 784 * 1.122 ** Math.min(t, 16));
  return true;
}

let lastAuto = 0;

/** Shuttle (Loom upgrade): once a second, merge the lowest-tier matching pair. Called every UI tick. */
export function tickLoom(): void {
  if (!S.loomOn || !S.ll.auto || !S.autoMerge || clock.T - lastAuto < 1) return;
  lastAuto = clock.T;
  const seen = new Map<number, number>();
  let best: [number, number] | null = null;
  for (const i of loomCells()) {
    const t = S.loom[i];
    if (!t) continue;
    const j = seen.get(t);
    if (j === undefined) seen.set(t, i);
    else if (!best || t < S.loom[best[1]]) best = [j, i];
  }
  if (best) merge(best[0], best[1]);
}

/** Heirloom: the bead a Big Bang leaves in the middle of the Loom. */
export function placeHeirloom(tier: number): void {
  const mid = Math.floor(stat.loomSize / 2);
  S.loom[mid * LOOM_MAX + mid] = tier;
}
