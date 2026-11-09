import { fmt } from '../core/util';
import type { GameState } from '../state/state';
import type { UpgradeDef } from './types';

/**
 * Layer 5: Multiverse → Threads ❖. Unlocked once every Singularity upgrade is maxed. A Multiverse
 * resets everything below it except the Eternal Autobuyer, and opens universe B next to A, joined
 * by a bridge. Threads come from cross-world chains: pops a chain makes in the other universe.
 */

/** A Law of Physics: one can be set per universe once its upgrade is bought. */
export interface LawDef { id: string; name: string; desc: string; upgrade: string }

export const LAWS: LawDef[] = [
  { id: 'square', name: 'Square Blasts', upgrade: 'lawSquare',
    desc: 'Blasts are squares: the same radius, but they reach into the corners.' },
  { id: 'repel', name: 'Repulsion', upgrade: 'lawRepel',
    desc: 'Orbs push each other away and settle into an even lattice. Chains spread far and evenly instead of clumping.' },
  { id: 'flip', name: 'Gravity Flip', upgrade: 'lawFlip',
    desc: 'Every 10 seconds, wells and the black hole switch between pulling and pushing.' },
  { id: 'quick', name: 'Quick Time', upgrade: 'lawQuick',
    desc: 'This universe runs 1.5× faster, but its orbs are worth ×0.6.' },
];

/** Height of the bridge before Wider Bridge, in world units. */
export const BRIDGE_SPAN = 260;

/** The first Law of Physics is free, so the second universe plays differently from the start. */
const ownsLaw = (S: GameState): boolean => LAWS.some(l => S.tl[l.upgrade] > 0);
const firstLawFree = (S: GameState): boolean => S.multiverses > 0 && !ownsLaw(S);

export const TL: UpgradeDef[] = [
  { id: 'bridge', name: 'Wider Bridge', base: 2, g: 1.8, max: 6,
    desc: (l, t) => `The bridge between universes spans ${BRIDGE_SPAN + 80 * l} → ${BRIDGE_SPAN + 80 * t} units` },
  { id: 'tune', name: 'Bridge Tuning', base: 3, g: 2, max: 5,
    desc: (l, t) => `Universe B's own dilation ^${(.5 + .1 * l).toFixed(1)} → ^${(.5 + .1 * t).toFixed(1)}` },
  { id: 'twin', name: 'Entanglement', base: 3, g: 1.7, max: 10,
    desc: (l, t) => `${4 * l}% → ${4 * t}% of new orbs get a twin in the other universe. Pop one and its twin pops too, in the same chain.` },
  { id: 'mirror', name: 'Mirror Universe', base: 4, g: 2.2, max: 4,
    desc: (l, t) => `${25 * l}% → ${25 * t}% of detonations echo at the mirrored spot in the other universe a moment later` },
  { id: 'melody', name: 'Melody', base: 5, g: 2, max: 6,
    desc: (l, t) => l === 0 ? 'A chain that pops the five colours of the melody in a row pays ×3 for the whole chain. Shown at the top.'
      : `Melody chains pay ×${2 + l} → ×${2 + t}` },
  { id: 'lawSquare', name: 'Law: Square Blasts', base: 4, g: 1, max: 1, free: firstLawFree,
    desc: () => 'Unlocks the Square Blasts law. ' + LAWS[0].desc },
  { id: 'lawRepel', name: 'Law: Repulsion', base: 4, g: 1, max: 1, free: firstLawFree,
    desc: () => 'Unlocks the Repulsion law. ' + LAWS[1].desc },
  { id: 'lawFlip', name: 'Law: Gravity Flip', base: 6, g: 1, max: 1, free: firstLawFree,
    desc: () => 'Unlocks the Gravity Flip law. ' + LAWS[2].desc },
  { id: 'lawQuick', name: 'Law: Quick Time', base: 6, g: 1, max: 1, free: firstLawFree,
    desc: () => 'Unlocks the Quick Time law. ' + LAWS[3].desc },
  { id: 'deja', name: 'Déjà Vu', base: 6, g: 1, max: 1,
    desc: () => 'Rift seals survive a Multiverse, so Auto-Supernova and every node type stay unlocked.' },
  { id: 'dmAuto', name: 'Dark Matter Autobuyer', base: 5, g: 1, max: 1,
    desc: () => 'Automatically buys the cheapest Dark Matter upgrade you can afford. Toggle it in the Collapse tab.' },
  { id: 'spark', name: 'Dark Spark', base: 2, g: 1.6, max: 10,
    desc: (l, t) => `Start each Multiverse with ${l ? fmt(10 ** (3 * l)) : 0} → ${fmt(10 ** (3 * t))} ◆ Dark Matter` },
  { id: 'weave', name: 'Weaving', base: 8, g: 2, max: 15,
    desc: (l, t) => `Thread gain ×${fmt(1.5 ** l)} → ×${fmt(1.5 ** t)}` },
];

/** Dark Matter a Multiverse starts with, from Dark Spark. */
export const sparkDM = (level: number): number => level ? 10 ** (3 * level) : 0;

/**
 * Threads that flow in live during a cycle from all cross-world pops (S.crossTotal):
 * log10(1 + pops)² / 2 times Weaving, so ~2 at 100, ~4 at 1K, ~12 at 100K, ~18 at 1M.
 */
export const liveThreads = (crossTotal: number, mult: number): number =>
  Math.floor(Math.log10(1 + crossTotal) ** 2 / 2 * mult);

/** Cross-world pops needed this cycle for live Threads to reach `target`. */
export const crossForLive = (target: number, mult: number): number =>
  Math.ceil(10 ** Math.sqrt(2 * target / mult) - 1);
