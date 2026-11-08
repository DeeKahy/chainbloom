import { fmt } from '../core/util';
import type { UpgradeDef } from './types';

/**
 * Layer 4: Singularity ◉. Unlocked once every Dark Matter upgrade is maxed and every Rift is sealed.
 * A Singularity resets Dark Matter, its upgrades and the Constellation, and from then on all orb
 * value is dilated (raised to a power below 1) until Event Horizon upgrades lift it back to ^1.
 */

/** Dilation exponent after the first Singularity, before upgrades. */
export const DILATION_BASE = .5;
/** Exponent added per Event Horizon level (10 levels reach ^1). */
export const DILATION_STEP = .05;

/**
 * Chain Memory: a multiplier from the longest chain ever (the "Biggest chain" stat).
 * Most of it builds between 1k and 100k (×2.5 → ×6.1), then it falls off fast (×7 at 1M,
 * ×7.5 at 10M) and creeps toward ×10 without reaching it.
 */
export function chainMemoryMult(best: number): number {
  const L = Math.log10(1 + best / 1000);
  return 1 + 9 * L / (L + 1.5);
}

export const SL: UpgradeDef[] = [
  { id: 'horizon', name: 'Event Horizon', base: 3, g: 1.55, max: 10,
    desc: (l, t) => `Dilation ^${(DILATION_BASE + DILATION_STEP * l).toFixed(2)} → ^${(DILATION_BASE + DILATION_STEP * t).toFixed(2)}. Orb value is raised to this power.` },
  { id: 'memory', name: 'Chain Memory', base: 25, g: 1, max: 1,
    desc: (_l, _t, stat) => `Singularity gain × your longest chain, on a log curve that flattens past ~100K. Now ×${stat.chainMem.toFixed(2)}.` },
  { id: 'hawking', name: 'Hawking Radiation', base: 10, g: 2, max: 20,
    desc: (l, t) => `Singularity gain ×${fmt(1.4 ** l)} → ×${fmt(1.4 ** t)}` },
  { id: 'accrete', name: 'Accretion', base: 4, g: 1.8, max: 10,
    desc: (l, t) => `Mass per orb popped near the black hole ×${fmt(1.5 ** l)} → ×${fmt(1.5 ** t)}` },
  { id: 'flare', name: 'Long Flare', base: 5, g: 1.7, max: 8,
    desc: (l, t) => `Flares last ${20 + 5 * l}s → ${20 + 5 * t}s` },
  { id: 'corona', name: 'Corona', base: 6, g: 1.8, max: 10,
    desc: (l, t) => `A flare lifts dilation by +${(.1 + .02 * l).toFixed(2)} → +${(.1 + .02 * t).toFixed(2)}` },
  { id: 'autoStar', name: 'Stardust Autobuyer', base: 12, g: 1, max: 1,
    desc: () => 'Automatically buys the cheapest Stardust upgrade you can afford. Toggle it in the Supernova tab.' },
  { id: 'autoCol', name: 'Auto-Collapse', base: 15, g: 1, max: 1,
    desc: () => 'Collapses for you when it would at least double your Dark Matter (held plus spent on upgrades), or after 5 minutes. Toggle it in the Collapse tab.' },
  { id: 'keepBoard', name: 'Star Chart', base: 20, g: 1, max: 1,
    desc: () => 'Your Constellation layout survives a Singularity (the nodes are kept, their Flux is not refunded).' },
];
