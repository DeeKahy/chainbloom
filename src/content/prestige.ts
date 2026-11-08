import { fmt } from '../core/util';
import type { UpgradeDef } from './types';

/** Layer 2: Stardust upgrades. Reset by Collapse. */
export const SU: UpgradeDef[] = [
  { id: 'sv', name: 'Stellar Core', base: 1, g: 1.8, max: 200, desc: (l, t) => `All value ×${fmt(1.6 ** l)} → ×${fmt(1.6 ** t)}` },
  { id: 'seed', name: 'Seed Fund', base: 1, g: 2, max: 10, desc: (l, t) => `Start each run with $${fmt(l ? 100 * 10 ** (l - 1) : 0)} → $${fmt(100 * 10 ** (t - 1))}` },
  { id: 'surge', name: 'Nebula Surge', base: 2, g: 1.7, max: 20, desc: (l, t) => `Spawn +${25 * l}% → +${25 * t}%, max orbs +${5 * l} → +${5 * t}` },
  { id: 'auto', name: 'Autonomy', base: 3, g: 3, max: 3, desc: (l, t) => `Free drones ${l} → ${t}` },
  { id: 'deep', name: 'Deep Chains', base: 4, g: 2.6, max: 8, desc: (l, t) => `Free chain depth +${l} → +${t}` },
  { id: 'crit', name: 'Fission', base: 5, g: 2, max: 8, desc: (l, t) => `${8 * l}% → ${8 * t}% chance a chain blast doesn't use up depth` },
];

/** Layer 3: Dark Matter upgrades. Never reset (except by wiping the save). */
export const DU: UpgradeDef[] = [
  { id: 'core', name: 'Dark Core', base: 1, g: 2, max: 100, desc: (l, t) => `All value ×${fmt(3 ** l)} → ×${fmt(3 ** t)}` },
  { id: 'fall', name: 'Starfall', base: 1, g: 2.2, max: 50, desc: (l, t) => `Stardust gain ×${fmt(1.5 ** l)} → ×${fmt(1.5 ** t)}` },
  { id: 'auto', name: 'Autobuyer', base: 2, g: 1, max: 1, desc: () => 'Automatically buys the cheapest upgrade. Toggle it next to the Buy buttons.' },
  { id: 'pulse', name: 'Pulsar', base: 2, g: 2, max: 10, desc: (l, t) => `Constellation core fires every ${(2 * .85 ** l).toFixed(2)}s → ${(2 * .85 ** t).toFixed(2)}s` },
  { id: 'mem', name: 'Nebula Memory', base: 2, g: 2, max: 10, desc: (l, t) => `Start each Collapse with ${fmt(l ? 5 * 4 ** (l - 1) : 0)} → ${fmt(5 * 4 ** (t - 1))} Stardust` },
  { id: 'expanse', name: 'Expanse', base: 3, g: 3, max: 3, desc: (l, t) => `Constellation radius ${3 + l} → ${3 + t}` },
];

/** Money a fresh run starts with, from Seed Fund. */
export const seedMoney = (seedLevel: number): number => seedLevel ? 100 * 10 ** (seedLevel - 1) : 0;

/** Stardust a Collapse starts with, from Nebula Memory. */
export const memoryStardust = (memLevel: number): number => memLevel ? 5 * 4 ** (memLevel - 1) : 0;
