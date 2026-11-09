import { initAudio, soundOn, tone } from '../audio';
import { clock, refreshAll } from '../core/app';
import { fmt } from '../core/util';
import { DU, memoryStardust, seedMoney, SU } from '../content/prestige';
import { SL } from '../content/singularity';
import { liveThreads, sparkDM, TL } from '../content/multiverse';
import { GL } from '../content/garden';
import { LL } from '../content/loom';
import { eraGain } from '../content/bang';
import { clearGardenFx, openGarden } from '../sim/garden';
import { placeHeirloom, tickLoom } from './loom';
import type { Chain } from './economy';
import { riftById, RIFTS } from '../content/rifts';
import type { RiftDef, UpgradeDef } from '../content/types';
import { UP } from '../content/upgrades';
import { field } from '../render/canvas';
import { colorOf } from '../render/sprites';
import { clearBoardFx, rebuildBoardMap } from '../sim/board';
import { activeWorlds, stillAll, addBlast, BlastKind, bridgeText, burst, newChain, useWorld, worlds, clearAll, clearHoles, clearRun, newMelody, screenFlash, world } from '../sim/world';
import { clearSave, resumeSaving, save } from '../state/save';
import { fresh, replaceState, S, type GameState } from '../state/state';
import { toast } from '../ui/toast';
import { autoRateAvg } from './economy';
import { recalc, stat } from './stats';

// ---------- the layer ladder ----------
/**
 * Which save fields each reset clears. A higher layer resets everything a lower one does.
 * Adding a layer 4 means adding a step here, a gain formula and a content file.
 */
function resetRunLayer(): void {
  S.money = seedMoney(S.st.seed);
  S.runEarned = 0;
  S.runTime = 0;
  for (const u of UP) S.lv[u.id] = 0;
  clearRun();
  clearGardenFx();
}

function resetStardustLayer(): void {
  for (const u of SU) S.st[u.id] = 0;
  S.starsCycle = 0;
  S.stardust = memoryStardust(S.dl.mem);
  resetRunLayer(); // after SU reset, so Seed Fund is 0 and money starts at 0
}

/** Singularity: Dark Matter, its upgrades and the Constellation go. Rift seals, records and settings stay. */
function resetDarkLayer(): void {
  for (const u of DU) S.dl[u.id] = 0;
  if (S.sl.keepAuto) S.dl.auto = 1; // Eternal Autobuyer
  S.dm = 0;
  if (S.sl.keepBoard) for (const n of S.board) n.c = 0; // Star Chart: layout kept, nothing to refund
  else S.board = [];
  rebuildBoardMap();
  clearBoardFx();
  S.flux = 0; S.fluxEver = 0; S.pulseBank = 0;
  S.rift = 0;
  S.colTime = 0;
  S.cyclePeak = 0;
  clearHoles();
  resetStardustLayer(); // after the DU reset, so Nebula Memory gives no Stardust
}

/**
 * Singularity upgrades that survive a Multiverse: the automation and Star Chart, so a new cycle
 * replays the lower layers by itself instead of by hand.
 */
const MV_KEEPS = ['keepAuto', 'autoStar', 'autoCol', 'keepBoard'];

/**
 * Thread upgrades a Big Bang keeps without Remembered Weave: the automation, Déjà Vu and the Laws
 * of Physics (they change how a universe plays rather than how strong it is).
 */
const BANG_KEEPS_TL = ['dmAuto', 'deja', 'lawSquare', 'lawRepel', 'lawFlip', 'lawQuick'];

/**
 * Big Bang: the Loom, Knots, Pollen, Threads and every layer below go. Seeds and the garden layout,
 * the Laws, the automation and the records stay; Era upgrades keep more.
 */
function resetBangLayer(): void {
  S.loom.fill(0); S.knots = 0;
  for (const u of LL) S.ll[u.id] = 0;
  S.pollen = 0; S.crosses = 0;
  if (!S.el.perennial) for (const u of GL) S.gl[u.id] = 0;
  if (!S.el.weave) for (const u of TL) if (!BANG_KEEPS_TL.includes(u.id)) S.tl[u.id] = 0;
  S.threads = 0; S.mvTime = 0;
  resetSingularityLayer();
  recalc(); // the Loom size for the Heirloom
  if (S.el.heir) placeHeirloom(2 + S.el.heir);
}

/** Multiverse: everything below goes, except MV_KEEPS (and Rift seals with Déjà Vu). */
function resetSingularityLayer(): void {
  const kept = MV_KEEPS.map(id => S.sl[id]);
  for (const u of SL) S.sl[u.id] = 0;
  MV_KEEPS.forEach((id, i) => { S.sl[id] = kept[i]; });
  S.sing = 0; S.singularities = 0;
  resetDarkLayer(); // also the Constellation, Stardust and the run; keeps the Autobuyer via keepAuto
  if (!S.tl.deja) S.riftsDone = [];
  S.dm = sparkDM(S.tl.spark);
  S.crossBest = 0; S.crossTotal = 0; S.threadsLive = 0;
}

// ---------- gains ----------
export const NOVA_MIN = 1e6;
export const COLLAPSE_MIN = 1000;

export const novaGain = (): number =>
  (S.rift || S.runEarned < NOVA_MIN) ? 0 : Math.floor(Math.sqrt(S.runEarned / 1e5) * stat.starMult);

/** Money needed this run for one more Stardust than `gain`. */
export const nextNovaAt = (gain: number): number => ((gain + 1) / stat.starMult) ** 2 * 1e5;

export const colGain = (): number =>
  (S.rift || S.starsCycle < COLLAPSE_MIN) ? 0 : Math.floor(2 * (S.starsCycle / COLLAPSE_MIN) ** .6);

/** The first Singularity needs every Dark Matter upgrade maxed and every Rift sealed. */
export const collapseComplete = (): boolean =>
  DU.every(u => S.dl[u.id] >= u.max) && RIFTS.every(r => S.riftsDone.includes(r.id));

/** Gate for layer 5 (not built yet): every Singularity upgrade maxed. */
export const singularityComplete = (): boolean => SL.every(u => S.sl[u.id] >= u.max);

/**
 * Threads ❖ paid on a Multiverse, from the best cross-world chain this cycle (pops it made in the
 * other universe): log10(1 + pops)², so ~9 at 1K, 16 at 10K, 25 at 100K, times Weaving. The first
 * Multiverse gives a flat 10 (there is no universe B to cross into yet). No Singularity is needed,
 * so a short cycle pays too. Threads also flow in live during the cycle (tickThreadFlow).
 */
export function mvGain(): number {
  if (S.rift) return 0;
  if (!S.multiverses) return singularityComplete() ? 10 : 0;
  return Math.floor(Math.log10(1 + S.crossBest) ** 2 * stat.threadMult);
}

/** Live Threads: pay out whatever liveThreads(crossTotal) has grown to since the last check. */
function tickThreadFlow(): void {
  if (!S.multiverses || S.rift) return;
  const target = liveThreads(S.crossTotal, stat.threadMult);
  if (target <= S.threadsLive) return;
  const g = target - S.threadsLive;
  S.threadsLive = target;
  S.threads += g; S.threadsEver += g;
  bridgeText(`+${fmt(g)} ❖`, '#7fd4ff', 22);
  if (soundOn()) tone(1046, .5, .05, 'triangle', 1568);
}

/** Money (as a power of ten) the cycle must peak at before a Singularity gives anything. */
export const SING_MIN_LOG = 30;

/**
 * Singularity points from the highest money of this cycle, on a log scale: 1 at 1e30, ~10 at 1e77,
 * ~60 at 1e154. Times Chain Memory and Hawking Radiation.
 */
export function singGain(): number {
  if (S.rift || (!S.singularities && !collapseComplete())) return 0;
  const lg = Math.log10(Math.max(1, S.cyclePeak));
  if (lg < SING_MIN_LOG) return 0;
  return Math.floor((lg / SING_MIN_LOG) ** 2.5 * stat.singMult);
}

/**
 * Currency spent on a shop's current levels. The auto-prestiges compare a gain with what you hold
 * plus this: with an autobuyer spending everything, "held" alone is ~0 and they would fire at once.
 */
function spentOn(defs: UpgradeDef[], levels: Record<string, number>): number {
  let sum = 0;
  for (const u of defs) for (let i = 0; i < levels[u.id]; i++) sum += Math.ceil(u.base * u.g ** i);
  return sum;
}

// ---------- Supernova (layer 2) ----------
export function doNova(auto: boolean): void {
  const g = novaGain();
  if (!g) return;
  const { W, H } = field;
  const visible = world.orbs.slice();
  resetRunLayer();
  // Cosmetic shockwave from the orbs that were just wiped.
  for (const o of visible) burst(o.x, o.y, colorOf(o).rgb, auto ? 3 : 6, 400, 1.2);
  for (let i = 0; i < (auto ? 3 : 6); i++) addBlast(W / 2, H / 2, Math.max(W, H) * (.3 + i * .15), 99, null, BlastKind.Drone);
  screenFlash('255,245,220', auto ? .35 : 1);
  world.shake = auto ? 4 : 12;

  S.stardust += g; S.starsEver += g; S.starsCycle += g; S.novas++;
  recalc();
  initAudio();
  if (auto) tone(220, .6, .06, 'sine', 880);
  else { tone(80, 1.6, .2, 'sawtooth', 900); tone(160, 1.4, .1, 'sine', 1400); }
  toast(`Supernova! +${fmt(g)} ✦ Stardust`, '#ffd34d');
  refreshAll();
  save(autoRateAvg());
}

/** Auto-Supernova: fire when it would at least double Stardust (held + spent on upgrades), or after 2 minutes in the run. */
export function maybeAutoNova(): void {
  if (!S.autoNova || !S.riftsDone.includes(4) || S.gathering) return;
  const g = novaGain();
  if (g && (g >= Math.max(1, S.stardust + spentOn(SU, S.st)) || S.runTime > 120)) doNova(true);
}

// ---------- Collapse (layer 3) ----------
export function doCollapse(auto = false): void {
  const g = colGain();
  if (!g) return;
  const first = !S.collapses;
  for (const o of world.orbs) burst(o.x, o.y, '#b98bff', auto ? 2 : 4, 300, 1.4);
  S.dm += g; S.dmEver += g; S.collapses++;
  S.colTime = 0;
  resetStardustLayer();
  recalc();
  screenFlash('110,50,200', auto ? .4 : 1);
  world.shake = auto ? 5 : 14;
  initAudio();
  if (auto) tone(300, 1, .08, 'sawtooth', 60);
  else { tone(400, 2, .18, 'sawtooth', 40); tone(60, 2, .15, 'sine', 30); }
  toast(`Collapse! +${fmt(g)} ◆ Dark Matter`, '#c9a6ff');
  if (first) setTimeout(() => toast('The Constellation is open. Switch views at the top left.', '#c9a6ff'), 1200);
  refreshAll();
  save(autoRateAvg());
}

/** Auto-Collapse (Singularity upgrade): when it would at least double Dark Matter (held + spent), or after 5 minutes. */
export function maybeAutoCollapse(): void {
  if (!S.sl.autoCol || !S.autoCol || S.gathering) return;
  const g = colGain();
  if (g && (g >= Math.max(1, S.dm + spentOn(DU, S.dl)) || S.colTime > 300)) doCollapse(true);
}

// ---------- Singularity (layer 4) ----------
export function doSingularity(): void {
  const g = singGain();
  if (!g) return;
  const first = !S.singularities;
  const { W, H } = field;
  for (const o of world.orbs) burst(o.x, o.y, '#ffb35c', 5, 500, 1.8);
  resetDarkLayer();
  S.sing += g; S.singEver += g; S.singularities++;
  recalc();
  for (let i = 0; i < 8; i++) addBlast(W / 2, H / 2, Math.max(W, H) * (.15 + i * .12), 99, null, BlastKind.Volatile);
  screenFlash('255,190,120', 1);
  world.shake = 18;
  initAudio(); tone(50, 3, .2, 'sawtooth', 20); tone(880, 2.5, .08, 'sine', 55); tone(220, 2, .1, 'triangle', 1760);
  toast(`Singularity! +${fmt(g)} ◉`, '#ffb35c');
  if (first) setTimeout(() => toast('A black hole sits at the centre now. Pop orbs near it to fill its mass, then chain hard during the flare.', '#ffb35c'), 1400);
  refreshAll();
  save(autoRateAvg());
}

// ---------- Multiverse (layer 5) ----------
export function doMultiverse(auto = false): void {
  const g = mvGain();
  if (!g || S.gathering) return;
  const first = !S.multiverses;
  const { W, H } = field;
  for (const o of world.orbs) burst(o.x, o.y, '#7fd4ff', 5, 600, 2);
  resetSingularityLayer();
  S.threads += g; S.threadsEver += g; S.multiverses++;
  S.mvTime = 0;
  if (first) S.melody = newMelody();
  recalc();
  for (let i = 0; i < (auto ? 4 : 10); i++) addBlast(W / 2, H / 2, Math.max(W, H) * (.1 + i * .1), 99, null, BlastKind.Mirror);
  screenFlash('190,230,255', auto ? .4 : 1);
  world.shake = auto ? 6 : 20;
  initAudio();
  if (auto) tone(660, 1, .06, 'sine', 990);
  else { tone(40, 3.5, .2, 'sine', 160); tone(1320, 2.5, .06, 'triangle', 330); tone(660, 3, .08, 'sine', 990); }
  toast(`Multiverse! +${fmt(g)} ❖ Threads`, '#7fd4ff');
  if (first) setTimeout(() => toast('A second universe opened beside this one. Chains that reach the bridge carry on over there.', '#7fd4ff'), 1500);
  refreshAll();
  save(autoRateAvg());
}

/** Called every UI tick: the cycle's peak, auto-prestiges, live Threads, layer unlocks, the Loom and the Big Bang. */
export function tickPrestige(): void {
  if (S.runEarned > S.cyclePeak) S.cyclePeak = S.runEarned;
  if (S.sl.keepAuto && !S.dl.auto) S.dl.auto = 1; // Eternal Autobuyer, the tick after it is bought
  maybeAutoCollapse();
  maybeAutoMultiverse();
  tickThreadFlow();
  tickLoom();
  checkUnlocks();
  if (bang.chain && (bang.chain.over || clock.T - bang.t > 30)) finishBigBang();
}

// ---------- unlocks for layers 6-8 ----------
export const GARDEN_THREADS = 250, GARDEN_HOPS = 3;
export const LOOM_POLLEN = 400, LOOM_POT = 4;
export const BANG_BEAD = 6, BANG_KNOTS = 20;

export const gardenReady = (): boolean => S.threadsEver >= GARDEN_THREADS && S.hopBest >= GARDEN_HOPS;
export const loomReady = (): boolean => S.gardenOn && S.pollenEver >= LOOM_POLLEN && S.potBest >= LOOM_POT;
export const bangReady = (): boolean => S.loomOn && S.bestBead >= BANG_BEAD && S.knotsEver >= BANG_KNOTS;

function checkUnlocks(): void {
  if (!S.gardenOn && gardenReady()) {
    openGarden();
    celebrate('125,255,176', 'The Garden opened: two seeds are waiting in the Garden tab. Plant them on the field.', '#7dffb0');
  }
  if (!S.loomOn && loomReady()) {
    S.loomOn = true;
    celebrate('255,207,122', 'The Loom opened: chains of 100+ pops now drop beads. Merge them in the Loom tab.', '#ffcf7a');
  }
  if (!S.bangOn && bangReady()) {
    S.bangOn = true;
    celebrate('255,154,213', 'Big Bang unlocked: the Stillness gathers the field for one chain to end everything.', '#ff9ad5');
  }
}

function celebrate(rgb: string, msg: string, col: string): void {
  screenFlash(rgb, .6);
  initAudio(); tone(523, .9, .08, 'triangle', 1046); tone(784, .9, .05, 'sine', 1568);
  toast(msg, col);
  refreshAll();
}

/** Seasons (Garden upgrade): open a Multiverse when it pays enough, or after 10 minutes. */
function maybeAutoMultiverse(): void {
  if (!S.gl.seasons || !S.autoMv || !S.multiverses || S.gathering || S.rift) return;
  const g = mvGain();
  if (g && ((S.mvTime > 120 && g >= Math.max(5, S.threadsLive)) || S.mvTime > 600)) doMultiverse(true);
}

// ---------- Big Bang (layer 8) ----------
/** The chain the Big Bang set off, and when; it pays out (and resets) once that chain is over. */
const bang = { chain: null as Chain | null, t: 0 };

export const bangInProgress = (): boolean => bang.chain !== null;

/** Orbs on the field in every universe: what a Big Bang would set off right now. */
export const gatheredOrbs = (): number => activeWorlds().reduce((n, w) => n + w.orbs.length, 0);

export function setGathering(on: boolean): void {
  if (on && (!S.bangOn || S.rift || bangInProgress())) return;
  S.gathering = on;
  if (on) { stillAll(); clearGardenFx(); }
  recalc();
  if (on) { screenFlash('255,196,232', .35); toast('The Stillness: nothing detonates now. Let the field fill, then set off the Big Bang.', '#ff9ad5'); }
  refreshAll();
}

/** Set off every orb in every universe as one chain. The Eras and the reset come when it ends. */
export function doBigBang(): void {
  if (!S.gathering || bangInProgress() || eraGain(gatheredOrbs(), stat.eraMult) < 1) return;
  S.gathering = false;
  recalc();
  useWorld(worlds[0]);
  const ch = newChain(field.W / 2, field.H / 2, false);
  for (const w of activeWorlds()) {
    useWorld(w);
    addBlast(field.W / 2, field.H / 2, Math.max(field.W, field.H) * 1.05, 0, ch, BlastKind.Volatile);
    for (let i = 0; i < 5; i++) addBlast(field.W / 2, field.H / 2, Math.max(field.W, field.H) * (.2 + i * .2), 99, null, BlastKind.Bloom);
    screenFlash('255,240,250', 1);
    w.shake = 24;
  }
  useWorld(worlds[0]);
  bang.chain = ch; bang.t = clock.T;
  initAudio(); tone(30, 4, .25, 'sawtooth', 15); tone(1760, 3, .06, 'sine', 110); tone(110, 3.5, .15, 'triangle', 440);
  refreshAll();
}

function finishBigBang(): void {
  const ch = bang.chain!;
  bang.chain = null;
  const g = Math.max(1, eraGain(ch.count, stat.eraMult));
  const first = !S.bangs;
  resetBangLayer();
  S.eras += g; S.erasEver += g; S.bangs++;
  recalc();
  screenFlash('255,154,213', .8);
  initAudio(); tone(523, 2, .08, 'triangle', 2093);
  toast(`Big Bang! The chain popped ${fmt(ch.count)} orbs: +${fmt(g)} ◈ Eras`, '#ff9ad5');
  if (first) setTimeout(() => toast('A new era. Your seeds and garden survived; spend Eras in the Big Bang tab.', '#ff9ad5'), 1500);
  refreshAll();
  save(autoRateAvg());
}

// ---------- Rifts ----------
export function enterRift(R: RiftDef): void {
  S.rift = R.id;
  resetRunLayer();
  recalc();
  screenFlash('120,60,200', .6);
  toast('Entered the ' + R.name, '#c9a6ff');
  refreshAll();
}

export function leaveRift(R: RiftDef): void {
  S.rift = 0;
  recalc();
  toast('Left the ' + R.name, '#c9a6ff');
  refreshAll();
}

/** Seal the current rift once its goal is reached. Money and upgrades are kept. */
export function checkRiftGoal(): void {
  const R = S.rift ? riftById(S.rift) : undefined;
  if (!R || S.runEarned < R.goal) return;
  S.riftsDone.push(R.id);
  S.rift = 0;
  recalc();
  screenFlash('200,160,255', .7);
  initAudio(); tone(523, .8, .08, 'triangle', 1046);
  toast(`${R.name} sealed! ${R.reward}`, '#c9a6ff');
  refreshAll();
}

// ---------- whole-save operations ----------
function adopt(next: GameState): void {
  replaceState(next);
  recalc();
  clearAll();
  clearBoardFx();
  rebuildBoardMap();
}

export function wipe(): void {
  adopt(fresh());
  clearSave();
  refreshAll();
}

export function importState(next: GameState): void {
  resumeSaving();
  adopt(next);
  save(autoRateAvg());
  refreshAll();
}

/** Drones keep earning at half rate while away, for up to 2 hours. Returns the amount. */
export function applyOfflineEarnings(): number {
  if (!S.saved || stat.drones <= 0 || S.lastRate <= 0) return 0;
  const secs = Math.min(7200, (Date.now() - S.saved) / 1000);
  if (secs <= 60) return 0;
  const g = S.lastRate * secs * .5;
  S.money += g; S.runEarned += g; S.total += g;
  return g;
}

