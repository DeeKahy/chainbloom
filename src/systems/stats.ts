import { riftById } from '../content/rifts';
import { S } from '../state/state';

/** Derived numbers, recomputed from the save by recalc(). Never saved. */
export interface Stats {
  fluxMult: number;
  value: number;
  starMult: number;
  pulseCD: number;
  boardR: number;
  spawn: number;
  cap: number;
  clickR: number;
  depth: number;
  chainR: number;
  combo: number;
  drones: number;
  interval: number;
  pVol: number;
  pGold: number;
  pSplit: number;
  unstable: number;
  wells: number;
  /** Value multiplier for orbs popped inside a well's glow (radius WELL_GLOW). */
  wellMult: number;
  cryRate: number;
  cryCap: number;
  cryVal: number;
  fission: number;
  /** Seconds before an orb decays; Infinity outside the Entropy Rift. */
  orbLifetime: number;
}

export const stat = {} as Stats;

export function recalc(): void {
  const l = S.lv, s = S.st, d = S.dl;
  stat.fluxMult = (1 + S.fluxEver) ** .35;
  stat.value = (1 + l.value) * 1.6 ** s.sv * 3 ** d.core * stat.fluxMult;
  stat.starMult = 1.5 ** d.fall;
  stat.pulseCD = 2 * .85 ** d.pulse;
  stat.boardR = 3 + d.expanse;
  stat.spawn = (1.5 + .6 * l.spawn) * (1 + .25 * s.surge);
  stat.cap = 30 + 8 * l.cap + 5 * s.surge;
  stat.clickR = 55 + 8 * l.clickR;
  stat.depth = l.chain + s.deep;
  stat.chainR = 45 + 5 * l.chainR;
  stat.combo = 1 + .12 * l.combo;
  stat.drones = l.auto + s.auto;
  stat.interval = 5 * .88 ** l.autoSpeed;
  stat.pVol = .03 * l.volatile;
  stat.pGold = .01 * l.gold;
  stat.pSplit = .02 * l.split;
  stat.unstable = .002 * l.unstable;
  stat.wells = l.well;
  stat.wellMult = 2;
  stat.cryRate = l.crystal ? 1.5 + 1.2 * l.crystal : 0;
  stat.cryCap = l.crystal ? 60 + 30 * l.crystal : 0;
  stat.cryVal = 2 + l.cryVal;
  stat.fission = .08 * s.crit;
  stat.orbLifetime = Infinity;

  const rift = S.rift ? riftById(S.rift) : undefined;
  if (rift) {
    rift.modify?.(stat);
    if (rift.orbLifetime) stat.orbLifetime = rift.orbLifetime;
  }
}
