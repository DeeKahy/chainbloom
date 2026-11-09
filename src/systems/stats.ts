import { riftById } from '../content/rifts';
import { chainMemoryMult, DILATION_BASE, DILATION_STEP } from '../content/singularity';
import { BRIDGE_SPAN } from '../content/multiverse';
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
  /** Seconds between violet (Mitosis) orbs spat out by each well. */
  wellOrbEvery: number;
  cryRate: number;
  cryCap: number;
  cryVal: number;
  fission: number;
  /** Exponent applied to orb value after the first Singularity (1 = no dilation). Flares add flareBonus. */
  dilation: number;
  flareBonus: number;
  flareDur: number;
  /** Mass per orb popped near the black hole, and mass needed for a flare. */
  massGain: number;
  massCap: number;
  /** Chain Memory multiplier on Singularity gain (1 until bought). */
  chainMem: number;
  singMult: number;
  /** Layer 5: twin chance, mirror chance, melody payout (1 = off), bridge span, universe B exponent, Thread gain. */
  pTwin: number;
  mirror: number;
  melodyMult: number;
  portalSpan: number;
  bExp: number;
  threadMult: number;
  /** The black hole exists from the first Singularity on. */
  hole: boolean;
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
  stat.wellMult = 1.2;
  stat.wellOrbEvery = 2;
  stat.cryRate = l.crystal ? 1.5 + 1.2 * l.crystal : 0;
  stat.cryCap = l.crystal ? 60 + 30 * l.crystal : 0;
  stat.cryVal = 2 + l.cryVal;
  stat.fission = .08 * s.crit;
  stat.orbLifetime = Infinity;

  const g = S.sl;
  stat.hole = S.singularities > 0;
  stat.dilation = stat.hole ? Math.min(1, DILATION_BASE + DILATION_STEP * g.horizon) : 1;
  stat.flareBonus = .1 + .02 * g.corona;
  stat.flareDur = 20 + 5 * g.flare;
  stat.massGain = 1.5 ** g.accrete;
  stat.massCap = 600;
  stat.chainMem = chainMemoryMult(S.best);
  stat.singMult = (g.memory ? stat.chainMem : 1) * 1.4 ** g.hawking;

  const m = S.tl;
  stat.pTwin = .04 * m.twin;
  stat.mirror = .25 * m.mirror;
  stat.melodyMult = m.melody ? 2 + m.melody : 1;
  stat.portalSpan = BRIDGE_SPAN + 80 * m.bridge;
  stat.bExp = Math.min(1, .5 + .1 * m.tune);
  stat.threadMult = 1.5 ** m.weave;

  const rift = S.rift ? riftById(S.rift) : undefined;
  if (rift) {
    rift.modify?.(stat);
    if (rift.orbLifetime) stat.orbLifetime = rift.orbLifetime;
  }
}
