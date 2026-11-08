import type { NodeDef, NodeType, RiftDef } from './types';

export const RIFTS: RiftDef[] = [
  { id: 1, name: 'Shallow Rift', rule: 'Chain depth is capped at 2.', goal: 1e7, reward: 'Unlocks the Amplifier node',
    modify: s => { s.depth = Math.min(s.depth, 2); } },
  { id: 2, name: 'Silent Rift', rule: 'No drones and no Instability. Every detonation is yours.', goal: 1e7, reward: 'Unlocks the Siphon node',
    modify: s => { s.drones = 0; s.unstable = 0; } },
  { id: 3, name: 'Drought Rift', rule: 'Orbs spawn 4× slower and max orbs is halved.', goal: 1e8, reward: 'Unlocks the Echo node',
    modify: s => { s.spawn /= 4; s.cap = Math.floor(s.cap / 2); } },
  { id: 4, name: 'Entropy Rift', rule: 'Orbs decay after 5 seconds without paying out.', goal: 1e9, reward: 'Unlocks Auto-Supernova',
    orbLifetime: 5 },
];

export const riftById = (id: number): RiftDef | undefined => RIFTS.find(r => r.id === id);

/** Rift whose seal unlocks Auto-Supernova. */
export const AUTO_NOVA_RIFT = 4;

export const NODES: Record<NodeType, NodeDef> = {
  collect: { name: 'Collector', col: '#7dffb0', mult: 1, icon: '◎', chime: 784, desc: 'Absorbs the pulse and turns all of it into Flux. The pulse stops here.' },
  relay: { name: 'Relay', col: '#6ee7ff', mult: 1, icon: '✦', chime: 523, desc: 'Passes the pulse on to every neighbouring node.' },
  amp: { name: 'Amplifier', col: '#ff7ab8', mult: 3, icon: '×2', req: 1, chime: 659, desc: 'Doubles the pulse, then passes it on. Chain them!' },
  siphon: { name: 'Siphon', col: '#ffd34d', mult: 4, icon: '½', req: 2, chime: 880, desc: 'Skims half the pulse as Flux and still passes the full pulse on.' },
  echo: { name: 'Echo', col: '#b98bff', mult: 6, icon: '))', req: 3, chime: 587, desc: 'Passes the pulse on, then fires it again from here a moment later.' },
};

export const NODE_TYPES = Object.keys(NODES) as NodeType[];
