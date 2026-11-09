import { fmt } from '../core/util';
import type { UpgradeDef } from './types';

/**
 * Layer 6: the Garden → Pollen ✿. Unlocked by 250 Threads ever and one chain that crosses the bridge
 * three times. No reset: flowers are planted on the orb field and change how chains run. A flower
 * grows from pops (its trigger gene), and when it blooms it fires its pattern gene as part of the
 * chain that fed it, with that chain's depth wound back, so the garden layout decides how far chains go.
 * Seeds are bred by crossing two of them.
 */

export interface Seed {
  id: number;
  /** Pattern gene: what a bloom fires (PATTERNS id). */
  p: string;
  /** Trigger gene: what makes it grow (TRIGGERS id). */
  t: string;
  /** Potency 1..stat.potMax: bigger blooms, more Pollen, more depth wound back. */
  pot: number;
  /** Colour 0-2, one of the normal orb colours. */
  hue: number;
}

/** A planted seed: which universe, and where as a fraction of that universe's field. */
export interface Bed { seed: number; w: number; fx: number; fy: number }

export interface GeneDef { id: string; name: string; icon: string; desc: string }

export const PATTERNS: GeneDef[] = [
  { id: 'ring', name: 'Ring', icon: '◎', desc: 'one wide blast at the flower' },
  { id: 'spray', name: 'Spray', icon: '✺', desc: 'six blasts in a circle around it' },
  { id: 'lance', name: 'Lance', icon: '➶', desc: 'a line of blasts toward the bridge (or the centre)' },
  { id: 'seek', name: 'Seeker', icon: '⌖', desc: 'blasts at the densest clusters on the field' },
  { id: 'gild', name: 'Gilding', icon: '✦', desc: 'turns the orbs around it gold, then blasts' },
  { id: 'echo', name: 'Echo', icon: '◌', desc: 'a ring now, and twice more after' },
];

export const TRIGGERS: GeneDef[] = [
  { id: 'pop', name: 'Any pop', icon: '•', desc: 'grows from every pop within reach' },
  { id: 'hue', name: 'Colour', icon: '●', desc: 'grows 3× from pops of its own colour within reach, ignores the rest' },
  { id: 'deep', name: 'Deep', icon: '▼', desc: 'grows 4× from pops at depth 5 or more within reach' },
  { id: 'cross', name: 'Bridge', icon: '⇄', desc: 'grows from every pop in its universe made by a chain from the other universe, anywhere' },
];

export const geneOf = (list: GeneDef[], id: string): GeneDef => list.find(g => g.id === id) ?? list[0];

/** Reach of a flower's growth triggers, in world units. */
export const FLOWER_REACH = 170;
/** Growth a flower needs to bloom, before Fertile Soil. */
export const GROW_NEED = 12;
/** Seconds a flower rests after blooming before it grows again. */
export const WILT = 1;

export const STARTER_SEEDS: Omit<Seed, 'id'>[] = [
  { p: 'ring', t: 'pop', pot: 1, hue: 0 },
  { p: 'spray', t: 'hue', pot: 1, hue: 1 },
];

/** Pollen cost of the next cross: grows with each cross until the next Big Bang. */
export const crossCost = (crosses: number): number => Math.ceil(4 * 1.5 ** crosses);

/** Thread gain multiplier from all Pollen ever earned (Cross-Pollination, always on). */
export const pollenThreadMult = (pollenEver: number): number => 1 + Math.log10(1 + pollenEver) / 4;

export const GL: UpgradeDef[] = [
  { id: 'beds', name: 'More Beds', base: 10, g: 2.5, max: 4,
    desc: (l, t) => `Flowers you can plant: ${2 + l} → ${2 + t} (plus Trellis)` },
  { id: 'fertile', name: 'Fertile Soil', base: 6, g: 2, max: 6,
    desc: (l, t) => `Growth a flower needs to bloom: ${fmt(GROW_NEED * .85 ** l)} → ${fmt(GROW_NEED * .85 ** t)}` },
  { id: 'roots', name: 'Deep Roots', base: 15, g: 3, max: 3,
    desc: (l, t) => `A bloom winds its chain's depth back by ${1 + l} → ${1 + t} more (plus half its potency)` },
  { id: 'nectar', name: 'Nectar', base: 10, g: 1.9, max: 10,
    desc: (l, t) => `Pollen per bloom ×${fmt(1.4 ** l)} → ×${fmt(1.4 ** t)}` },
  { id: 'mutagen', name: 'Mutagen', base: 8, g: 2.2, max: 4,
    desc: (l, t) => `Chance a crossed seed mutates a gene: ${20 + 10 * l}% → ${20 + 10 * t}%` },
  { id: 'vault', name: 'Seed Vault', base: 12, g: 2, max: 3,
    desc: (l, t) => `Seeds you can keep: ${6 + 2 * l} → ${6 + 2 * t}` },
  { id: 'hybrid', name: 'Hybrid Vigour', base: 40, g: 3, max: 3,
    desc: (l, t) => `Highest potency a seed can reach: ${5 + l} → ${5 + t}` },
  { id: 'seasons', name: 'Seasons', base: 30, g: 1, max: 1,
    desc: () => 'Auto-Multiverse: opens a new Multiverse when it pays at least 5 Threads and at least what flowed in live this cycle (after 2 minutes), or after 10 minutes. Toggle it above.' },
];
