import { fmt } from '../core/util';
import type { UpgradeDef } from './types';

/**
 * Layer 8: Big Bang → Eras ◈. Unlocked by a tier-6 bead on the Loom and 20 Knots ever.
 * The prestige is played, not clicked: during the Stillness nothing detonates and the field fills
 * far past its cap, then the Big Bang sets every orb off in one chain. Eras come from that chain's
 * length. It resets everything below except automation, Laws, seeds and the garden layout.
 */

/** Eras from the Big Bang chain: sqrt(pops / 250), so 1 at 250, 3 at ~2.3K, 6 at 9K. */
export const eraGain = (pops: number, mult: number): number => Math.floor(Math.sqrt(pops / 250) * mult);

export const EL: UpgradeDef[] = [
  { id: 'light', name: 'Old Light', base: 1, g: 1.7, max: 10,
    desc: (l, t) => `Orb value ×${1 + l} → ×${1 + t}` },
  { id: 'still', name: 'Long Stillness', base: 2, g: 2, max: 6,
    desc: (l, t) => `The Stillness holds ×${4 + l} → ×${4 + t} the usual orb cap` },
  { id: 'first', name: 'First Thread', base: 2, g: 2, max: 6,
    desc: (l, t) => `Thread gain ×${fmt(1.5 ** l)} → ×${fmt(1.5 ** t)}` },
  { id: 'echo', name: 'Afterglow', base: 3, g: 2, max: 5,
    desc: (l, t) => `Era gain ×${fmt(1.25 ** l)} → ×${fmt(1.25 ** t)}` },
  { id: 'heir', name: 'Heirloom', base: 3, g: 2.5, max: 4,
    desc: (l, t) => `Each Big Bang leaves a tier ${l ? 2 + l : '-'} → ${2 + t} bead on the Loom` },
  { id: 'weave', name: 'Remembered Weave', base: 4, g: 1, max: 1,
    desc: () => 'Every Multiverse upgrade survives a Big Bang.' },
  { id: 'perennial', name: 'Perennial', base: 4, g: 1, max: 1,
    desc: () => 'Every Garden upgrade survives a Big Bang.' },
];
