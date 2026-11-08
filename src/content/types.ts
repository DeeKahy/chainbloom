import type { GameState } from '../state/state';
import type { Stats } from '../systems/stats';

/** A levelled upgrade bought with some currency. Cost of level l is base * g^l. */
export interface UpgradeDef {
  id: string;
  name: string;
  base: number;
  g: number;
  max: number;
  desc: (level: number, stat: Stats) => string;
}

/** A run upgrade (money shop): adds a category and an optional unlock condition. */
export interface RunUpgradeDef extends UpgradeDef {
  cat: string;
  hint?: string;
  unlock?: (S: GameState, stat: Stats) => boolean;
}

export interface RiftDef {
  id: number;
  name: string;
  rule: string;
  goal: number;
  reward: string;
  /** Applied at the end of recalc() while inside this rift. */
  modify?: (stat: Stats) => void;
  /** Orbs vanish without paying after this many seconds. */
  orbLifetime?: number;
}

export type NodeType = 'collect' | 'relay' | 'amp' | 'siphon' | 'echo';

export interface NodeDef {
  name: string;
  col: string;
  mult: number;
  icon: string;
  /** Rift id that must be sealed to unlock this node. */
  req?: number;
  desc: string;
  chime: number;
}
