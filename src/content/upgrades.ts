import type { RunUpgradeDef } from './types';

/** Layer 1: run upgrades bought with money. Reset by Supernova and everything above. */
export const UP: RunUpgradeDef[] = [
  { id: 'value', cat: 'Basics', name: 'Denser Orbs', base: 10, g: 1.42, max: 300,
    desc: l => `Orb value ${l + 1} → ${l + 2}` },
  { id: 'spawn', cat: 'Basics', name: 'Orb Fountain', base: 15, g: 1.5, max: 40,
    desc: l => `Spawn rate ${(1.5 + .6 * l).toFixed(1)}/s → ${(1.5 + .6 * (l + 1)).toFixed(1)}/s` },
  { id: 'cap', cat: 'Basics', name: 'Wider Field', base: 25, g: 1.5, max: 40,
    desc: l => `Max orbs ${30 + 8 * l} → ${38 + 8 * l}` },
  { id: 'clickR', cat: 'Basics', name: 'Bigger Bang', base: 20, g: 1.65, max: 15,
    desc: l => `Click blast radius ${55 + 8 * l} → ${63 + 8 * l}` },

  { id: 'chain', cat: 'Chains', name: 'Chain Reaction', base: 100, g: 4, max: 12, hint: 'Earn $40 this run',
    unlock: S => S.runEarned >= 40,
    desc: l => l === 0 ? 'Popped orbs explode too, popping their neighbours. Depth 0 → 1' : `Chain depth ${l} → ${l + 1}` },
  { id: 'chainR', cat: 'Chains', name: 'Shockwave', base: 150, g: 1.75, max: 15, hint: 'Requires Chain Reaction',
    unlock: (_S, stat) => stat.depth >= 1,
    desc: l => `Chain blast radius ${45 + 5 * l} → ${50 + 5 * l}` },
  { id: 'combo', cat: 'Chains', name: 'Resonance', base: 300, g: 2.1, max: 25, hint: 'Requires Chain Reaction',
    unlock: (_S, stat) => stat.depth >= 1,
    desc: l => `Each chain step multiplies value ×${(1 + .12 * l).toFixed(2)} → ×${(1 + .12 * (l + 1)).toFixed(2)}` },

  { id: 'auto', cat: 'Automation', name: 'Detonator Drone', base: 500, g: 3.2, max: 6, hint: 'Earn $400 with chains',
    unlock: (S, stat) => stat.depth >= 1 && S.runEarned >= 400,
    desc: (_l, stat) => `Drones ${stat.drones} → ${stat.drones + 1}. Each one fires at the densest cluster.` },
  { id: 'autoSpeed', cat: 'Automation', name: 'Drone Overclock', base: 900, g: 1.9, max: 20, hint: 'Requires a drone',
    unlock: (_S, stat) => stat.drones >= 1,
    desc: l => `Drone fire interval ${(5 * .88 ** l).toFixed(2)}s → ${(5 * .88 ** (l + 1)).toFixed(2)}s` },
  { id: 'unstable', cat: 'Automation', name: 'Instability', base: 30000, g: 2.2, max: 15, hint: 'Earn $30K this run',
    unlock: S => S.runEarned >= 30000,
    desc: l => `Orbs randomly go critical and detonate. ${(.2 * l).toFixed(1)}% → ${(.2 * (l + 1)).toFixed(1)}% per orb per second` },

  { id: 'volatile', cat: 'Exotic orbs', name: 'Volatile Orbs', base: 2000, g: 2.3, max: 10, hint: 'Reach chain depth 2',
    unlock: (_S, stat) => stat.depth >= 2,
    desc: l => `Red orbs ${3 * l}% → ${3 * (l + 1)}%. Huge blast that doesn't use up chain depth.` },
  { id: 'gold', cat: 'Exotic orbs', name: 'Golden Orbs', base: 4000, g: 2.4, max: 10, hint: 'Earn $3K this run',
    unlock: S => S.runEarned >= 3000,
    desc: l => `Gold orbs ${l}% → ${l + 1}%. Worth ×15.` },
  { id: 'split', cat: 'Exotic orbs', name: 'Mitosis', base: 12000, g: 2.5, max: 10, hint: 'Earn $12K this run',
    unlock: S => S.runEarned >= 12000,
    desc: l => `Violet orbs ${2 * l}% → ${2 * (l + 1)}%. Burst into 3 fresh orbs when popped.` },

  { id: 'well', cat: 'Field', name: 'Gravity Well', base: 80000, g: 6, max: 3, hint: 'Earn $80K this run',
    unlock: S => S.runEarned >= 80000,
    desc: l => `Wells ${l} → ${l + 1}. Drifting wells pull orbs into dense swirls.` },
  { id: 'crystal', cat: 'Field', name: 'Crystal Lattice', base: 200000, g: 2.8, max: 12, hint: 'Earn $200K this run',
    unlock: S => S.runEarned >= 200000,
    desc: l => l === 0 ? 'Crystals grow across the field. Touch one and the whole lattice shatters, firing blasts as it goes.'
      : `Growth ${(1.5 + 1.2 * l).toFixed(1)}/s → ${(1.5 + 1.2 * (l + 1)).toFixed(1)}/s, max nodes ${60 + 30 * l} → ${90 + 30 * l}` },
  { id: 'cryVal', cat: 'Field', name: 'Prismatic Shards', base: 500000, g: 2.2, max: 30, hint: 'Requires Crystal Lattice',
    unlock: S => S.lv.crystal >= 1,
    desc: l => `Each shattered node is worth ×${2 + l} → ×${3 + l} orb value` },
];
