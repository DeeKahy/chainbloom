import { fmt } from '../core/util';
import type { UpgradeDef } from './types';

/**
 * Layer 7: the Loom → Knots ⌘. Unlocked by 400 Pollen ever and a seed of potency 4. A merge board:
 * every chain of 100+ pops drops a bead (tier from its length), two beads of a tier merge into the
 * next, and the beads on the board multiply orb value. Merging into tier 3+ pays Knots.
 */

/** The board is stored as LOOM_MAX × LOOM_MAX cells (0 = empty, else the bead's tier). */
export const LOOM_MAX = 7;
export const LOOM_BASE = 5;
/** Shortest chain that drops a bead. */
export const BEAD_MIN = 100;

/** Tier of the bead a chain drops: 1 at 100 pops, 2 at 1K, 3 at 10K... */
export const beadTier = (count: number): number => Math.max(1, Math.floor(Math.log10(count)) - 1);

/** Knots paid for merging into this tier. */
export const knotsFor = (tier: number): number => Math.max(0, tier - 2);

/** Orb value multiplier from the beads on the board (each bead counts 2^(tier-1)). */
export const loomValueMult = (cells: number[], taut: number): number => {
  let score = 0;
  for (const t of cells) if (t > 0) score += 2 ** (t - 1);
  return 1 + score * (1 + .25 * taut) / 20;
};

export const LL: UpgradeDef[] = [
  { id: 'wide', name: 'Wider Loom', base: 5, g: 4, max: 2,
    desc: (l, t) => `The Loom is ${LOOM_BASE + l}×${LOOM_BASE + l} → ${LOOM_BASE + t}×${LOOM_BASE + t}` },
  { id: 'heavy', name: 'Heavy Beads', base: 3, g: 2, max: 5,
    desc: (l, t) => `${10 * l}% → ${10 * t}% of beads drop one tier higher` },
  { id: 'taut', name: 'Taut Warp', base: 4, g: 2, max: 8,
    desc: (l, t) => `The Loom's orb value bonus +${25 * l}% → +${25 * t}%` },
  { id: 'trellis', name: 'Trellis', base: 10, g: 3, max: 2,
    desc: (l, t) => `Garden beds +${l} → +${t}` },
  { id: 'auto', name: 'Shuttle', base: 8, g: 1, max: 1,
    desc: () => 'Merges the lowest matching pair of beads for you every second. Toggle it above.' },
];

export const loomBonusText = (mult: number, top: number): string =>
  `Orb value ×${fmt(mult)} · Pollen ×${(1 + .2 * top).toFixed(1)} (best bead on the board: tier ${top})`;
