import { riftById } from '../content/rifts';
import { chainMemoryMult, DILATION_BASE, DILATION_STEP } from '../content/singularity';
import { BRIDGE_SPAN } from '../content/multiverse';
import { GROW_NEED, pollenThreadMult } from '../content/garden';
import { loomValueMult, LOOM_BASE } from '../content/loom';
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
  /** Layer 6 Garden: beds, growth to bloom, depth wound back per bloom, mutation, bank size, potency cap, Pollen per bloom. */
  beds: number;
  growNeed: number;
  refresh: number;
  mutate: number;
  bank: number;
  potMax: number;
  pollenMult: number;
  /** Layer 7 Loom: board side, orb value multiplier, best bead on the board, chance of a heavier bead. */
  loomSize: number;
  loomMult: number;
  loomTop: number;
  heavy: number;
  /** Layer 8 Big Bang: Stillness cap multiplier and Era gain multiplier. */
  holdMult: number;
  eraMult: number;
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

  const gd = S.gl, lo = S.ll, er = S.el;
  stat.beds = 2 + gd.beds + lo.trellis;
  stat.growNeed = GROW_NEED * .85 ** gd.fertile;
  stat.refresh = 1 + gd.roots;
  stat.mutate = .2 + .1 * gd.mutagen;
  stat.bank = 6 + 2 * gd.vault;
  stat.potMax = 5 + gd.hybrid;
  stat.loomSize = LOOM_BASE + lo.wide;
  stat.loomMult = loomValueMult(S.loom, lo.taut);
  stat.loomTop = Math.max(0, ...S.loom);
  stat.heavy = .1 * lo.heavy;
  stat.pollenMult = 1.4 ** gd.nectar * (1 + .2 * stat.loomTop);
  stat.holdMult = 4 + er.still;
  stat.eraMult = 1.25 ** er.echo;
  stat.value *= stat.loomMult * (1 + er.light);
  stat.threadMult *= pollenThreadMult(S.pollenEver) * 1.5 ** er.first;

  // The Stillness (gathering for a Big Bang): nothing detonates, and the field fills far past its cap.
  if (S.gathering) {
    stat.cap *= stat.holdMult;
    stat.spawn *= 4;
    stat.drones = 0;
    stat.unstable = 0;
    stat.cryRate = 0;
  }

  const rift = S.rift ? riftById(S.rift) : undefined;
  if (rift) {
    rift.modify?.(stat);
    if (rift.orbLifetime) stat.orbLifetime = rift.orbLifetime;
  }
}
