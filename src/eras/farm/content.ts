import { fmt } from '../../core/util';
import type { UpgradeDef } from '../../content/types';

/**
 * Era 2, layer 1: the Meadow → Pollen ✿. A square plot of soil. Flowers grow in real time; tap a
 * ripe one and it blooms, sending pollen to the tiles its pattern reaches. Any ripe flower the
 * pollen lands on blooms too, so a bloom spreads across the meadow as a chain. Each step deeper
 * pays more (Sweet Scent), so the layout is the puzzle. Pollen passing between two different
 * strains can drop a hybrid seed: a new strain, sometimes with a mutated gene.
 */

/** A strain is a seed you can plant as often as you like. */
export interface Strain {
  id: number;
  /** Pattern gene (PATTERNS id): where its pollen goes when it blooms. */
  p: string;
  /** Colour 0..HUES.length-1. Pollen landing on its own colour pays ×2. */
  hue: number;
  /** Potency 1..potMax: more Pollen per bloom (pot^1.5), slower growth. */
  pot: number;
}

export interface PatternDef {
  id: string;
  /** The flower this pattern grows into, for the strain's name. */
  flower: string;
  icon: string;
  desc: string;
  /** Grid offsets [dx, dy] its pollen reaches; empty for the special patterns (wind, seek). */
  reach: [number, number][];
  /** Growth time factor. */
  slow: number;
  /** Only appears by mutation. */
  rare?: boolean;
}

const line = (dx: number, dy: number, n: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => [dx * (i + 1), dy * (i + 1)] as [number, number]);

export const PATTERNS: PatternDef[] = [
  { id: 'cross', flower: 'Daisy', icon: '✚', desc: 'the four tiles beside it', slow: 1,
    reach: [[1, 0], [-1, 0], [0, 1], [0, -1]] },
  { id: 'diag', flower: 'Poppy', icon: '✕', desc: 'the four diagonal tiles', slow: 1,
    reach: [[1, 1], [-1, 1], [1, -1], [-1, -1]] },
  { id: 'row', flower: 'Tulip', icon: '↔', desc: 'two tiles left and two right', slow: 1,
    reach: [...line(1, 0, 2), ...line(-1, 0, 2)] },
  { id: 'col', flower: 'Foxglove', icon: '↕', desc: 'two tiles up and two down', slow: 1,
    reach: [...line(0, 1, 2), ...line(0, -1, 2)] },
  { id: 'ring', flower: 'Aster', icon: '✺', desc: 'all eight tiles around it (grows slower)', slow: 1.5,
    reach: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] },
  { id: 'knight', flower: 'Clover', icon: '♞', desc: 'the eight tiles a knight jumps to', slow: 1.2, rare: true,
    reach: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] },
  { id: 'wind', flower: 'Dandelion', icon: '༄', desc: 'three random tiles anywhere on the plot', slow: 1.1, rare: true, reach: [] },
  { id: 'seek', flower: 'Orchid', icon: '❀', desc: 'the two nearest ripe flowers, wherever they are', slow: 1.4, rare: true, reach: [] },
];

export const patternOf = (id: string): PatternDef => PATTERNS.find(p => p.id === id) ?? PATTERNS[0];

export const HUES = [
  { name: 'Buttercup', col: '#f6c437', soft: '#ffe9a3' },
  { name: 'Rose', col: '#ef7fa6', soft: '#ffd3e1' },
  { name: 'Lavender', col: '#a88be0', soft: '#e3d8ff' },
  { name: 'Cornflower', col: '#6aa6e8', soft: '#cfe4ff' },
  { name: 'Snow', col: '#f4efe4', soft: '#ffffff' },
];

export const strainName = (s: Strain): string => `${HUES[s.hue].name} ${patternOf(s.p).flower}`;
export const genome = (s: Omit<Strain, 'id'>): string => `${s.p}:${s.hue}:${s.pot}`;

export const STARTER_STRAINS: Omit<Strain, 'id'>[] = [
  { p: 'cross', hue: 0, pot: 1 },
  { p: 'diag', hue: 1, pot: 1 },
];

/** The plot is stored as PLOT_MAX × PLOT_MAX tiles; the part in use grows from the middle. */
export const PLOT_MAX = 9;
export const PLOT_BASE = 5;

/** Seconds for a potency-1 Daisy to grow from seed to ripe, before Sunlight. */
export const GROW_BASE = 8;
/** Growth a flower gets when pollen lands on it before it is ripe. */
export const POLLEN_BOOST = .2;
/** Seconds pollen takes per tile it travels (wind and seekers fly slower, further). */
export const POLLEN_SPEED = .16;

export const potFactor = (pot: number): number => pot ** 1.5;
export const growTime = (s: Strain, sun: number): number => GROW_BASE * (1 + .3 * (s.pot - 1)) * patternOf(s.p).slow * .88 ** sun;

/** Pollen for one bloom at chain depth d. */
export const bloomValue = (s: Strain, d: number, kindred: boolean, nectar: number, scent: number): number =>
  potFactor(s.pot) * 1.35 ** nectar * depthMult(d, scent) * (kindred ? 2 : 1);

/** Chain depth where the bonus stops compounding and turns logarithmic. */
export const DEPTH_SOFT = 8;

/**
 * Chain bonus at depth d: compounds by the Sweet Scent step up to DEPTH_SOFT, then only grows with
 * the log of the extra depth. A 9×9 snake (depth ~80) pays a few times a depth-8 bloom, not 10^12×.
 */
export function depthMult(d: number, scent: number): number {
  const step = scentStep(scent);
  if (d <= DEPTH_SOFT) return (1 + step) ** d;
  return (1 + step) ** DEPTH_SOFT * (1 + Math.log(1 + (d - DEPTH_SOFT) * step));
}

export const scentStep = (l: number): number => .12 + .03 * l;
export const hybridChance = (l: number): number => .1 + .05 * l;
export const mutationChance = (l: number): number => .25 + .05 * l;
export const potMax = (l: number): number => 3 + l;
export const breezeEvery = (l: number): number => 15 * .85 ** (l - 1);

export const FL: UpgradeDef[] = [
  { id: 'plot', name: 'Clear Land', base: 60, g: 5, max: PLOT_MAX - PLOT_BASE,
    desc: (l, t) => `The meadow is ${PLOT_BASE + l}×${PLOT_BASE + l} → ${PLOT_BASE + t}×${PLOT_BASE + t}` },
  { id: 'sun', name: 'Sunlight', base: 8, g: 1.6, max: 15,
    desc: (l, t) => `A Daisy ripens in ${fmt(GROW_BASE * .88 ** l)}s → ${fmt(GROW_BASE * .88 ** t)}s` },
  { id: 'nectar', name: 'Nectar', base: 15, g: 1.75, max: 25,
    desc: (l, t) => `Pollen per bloom ×${fmt(1.35 ** l)} → ×${fmt(1.35 ** t)}` },
  { id: 'scent', name: 'Sweet Scent', base: 40, g: 2.1, max: 10,
    desc: (l, t) => `Each of the first ${DEPTH_SOFT} blooms deeper in a chain pays +${Math.round(scentStep(l) * 100)}% → +${Math.round(scentStep(t) * 100)}% more (slower after that)` },
  { id: 'breeze', name: 'Breeze', base: 30, g: 2, max: 10,
    desc: (l, t) => l ? `A breeze blooms a ripe flower every ${fmt(breezeEvery(l))}s → ${fmt(breezeEvery(t))}s, even while you're away`
      : `A breeze blooms a ripe flower every ${fmt(breezeEvery(t))}s, even while you're away` },
  { id: 'wild', name: 'Wild Pollen', base: 25, g: 2, max: 6,
    desc: (l, t) => `Hybrid seed chance ${Math.round(hybridChance(l) * 100)}% → ${Math.round(hybridChance(t) * 100)}%, mutation ${Math.round(mutationChance(l) * 100)}% → ${Math.round(mutationChance(t) * 100)}%` },
  { id: 'vigour', name: 'Hybrid Vigour', base: 100, g: 3.2, max: 5,
    desc: (l, t) => `Highest potency a hybrid can reach: ${potMax(l)} → ${potMax(t)}` },
];
