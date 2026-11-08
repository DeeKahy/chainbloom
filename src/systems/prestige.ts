import { initAudio, tone } from '../audio';
import { refreshAll } from '../core/app';
import { fmt } from '../core/util';
import { DU, memoryStardust, seedMoney, SU } from '../content/prestige';
import { riftById, RIFTS } from '../content/rifts';
import type { RiftDef } from '../content/types';
import { UP } from '../content/upgrades';
import { field } from '../render/canvas';
import { colorOf } from '../render/sprites';
import { clearBoardFx, rebuildBoardMap } from '../sim/board';
import { addBlast, BlastKind, burst, clearAll, clearRun, screenFlash, world } from '../sim/world';
import { clearSave, save } from '../state/save';
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
  S.dm = 0;
  if (S.sl.keepBoard) for (const n of S.board) n.c = 0; // Star Chart: layout kept, nothing to refund
  else S.board = [];
  rebuildBoardMap();
  clearBoardFx();
  S.flux = 0; S.fluxEver = 0; S.pulseBank = 0;
  S.rift = 0;
  S.colTime = 0;
  S.cyclePeak = 0;
  world.mass = 0; world.flareT = 0;
  resetStardustLayer(); // after the DU reset, so Nebula Memory gives no Stardust
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

/** Auto-Supernova: fire when it would at least double Stardust, or after 2 minutes in the run. */
export function maybeAutoNova(): void {
  if (!S.autoNova || !S.riftsDone.includes(4)) return;
  const g = novaGain();
  if (g && (g >= Math.max(1, S.stardust) || S.runTime > 120)) doNova(true);
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

/** Auto-Collapse (Singularity upgrade): when it would at least double Dark Matter, or after 5 minutes. */
export function maybeAutoCollapse(): void {
  if (!S.sl.autoCol || !S.autoCol) return;
  const g = colGain();
  if (g && (g >= Math.max(1, S.dm) || S.colTime > 300)) doCollapse(true);
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

/** Called every UI tick: track the cycle's peak (the Singularity gain) and run Auto-Collapse. */
export function tickPrestige(): void {
  if (S.runEarned > S.cyclePeak) S.cyclePeak = S.runEarned;
  maybeAutoCollapse();
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

