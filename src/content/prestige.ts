import { fmt } from '../core/util';
import type { UpgradeDef } from './types';

/** Layer 2: Stardust upgrades. Reset by Collapse. */
export const SU: UpgradeDef[] = [
  { id: 'sv', name: 'Stellar Core', base: 1, g: 1.8, max: 200, desc: l => `All value ×${fmt(1.6 ** l)} → ×${fmt(1.6 ** (l + 1))}` },
  { id: 'seed', name: 'Seed Fund', base: 1, g: 2, max: 10, desc: l => `Start each run with $${fmt(l ? 100 * 10 ** (l - 1) : 0)} → $${fmt(100 * 10 ** l)}` },
  { id: 'surge', name: 'Nebula Surge', base: 2, g: 1.7, max: 20, desc: l => `Spawn +${25 * l}% → +${25 * (l + 1)}%, max orbs +${5 * l} → +${5 * (l + 1)}` },
  { id: 'auto', name: 'Autonomy', base: 3, g: 3, max: 3, desc: l => `Free drones ${l} → ${l + 1}` },
  { id: 'deep', name: 'Deep Chains', base: 4, g: 2.6, max: 8, desc: l => `Free chain depth +${l} → +${l + 1}` },
  { id: 'crit', name: 'Fission', base: 5, g: 2, max: 8, desc: l => `${8 * l}% → ${8 * (l + 1)}% chance a chain blast doesn't use up depth` },
];

/** Layer 3: Dark Matter upgrades. Never reset (except by wiping the save). */
export const DU: UpgradeDef[] = [
  { id: 'core', name: 'Dark Core', base: 1, g: 2, max: 100, desc: l => `All value ×${fmt(3 ** l)} → ×${fmt(3 ** (l + 1))}` },
  { id: 'fall', name: 'Starfall', base: 1, g: 2.2, max: 50, desc: l => `Stardust gain ×${fmt(1.5 ** l)} → ×${fmt(1.5 ** (l + 1))}` },
  { id: 'auto', name: 'Autobuyer', base: 2, g: 1, max: 1, desc: () => 'Automatically buys the cheapest upgrade. Toggle it next to the Buy buttons.' },
  { id: 'pulse', name: 'Pulsar', base: 2, g: 2, max: 10, desc: l => `Constellation core fires every ${(2 * .85 ** l).toFixed(2)}s → ${(2 * .85 ** (l + 1)).toFixed(2)}s` },
  { id: 'mem', name: 'Nebula Memory', base: 2, g: 2, max: 10, desc: l => `Start each Collapse with ${fmt(l ? 5 * 4 ** (l - 1) : 0)} → ${fmt(5 * 4 ** l)} Stardust` },
  { id: 'expanse', name: 'Expanse', base: 3, g: 3, max: 3, desc: l => `Constellation radius ${3 + l} → ${4 + l}` },
];

/** Money a fresh run starts with, from Seed Fund. */
export const seedMoney = (seedLevel: number): number => seedLevel ? 100 * 10 ** (seedLevel - 1) : 0;

/** Stardust a Collapse starts with, from Nebula Memory. */
export const memoryStardust = (memLevel: number): number => memLevel ? 5 * 4 ** (memLevel - 1) : 0;
