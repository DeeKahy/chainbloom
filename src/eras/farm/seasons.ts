import { S } from '../../state/state';
import {
  APIARY_PLOT, APIARY_POLLEN, beesPerHive, FL, HARVEST_MIN, harvestGain, HL, PLOT_MAX, SEASONS_HIVES, SEASONS_HONEY,
} from './content';
import { clearBees } from './apiary';
import { meadow, type Chain } from './meadow';

/**
 * Layer unlocks and the Seasons (layer 3). Every reset of the farm goes through here.
 */

const F = () => S.farm;

export const apiaryReady = (): boolean => F().lv.plot >= APIARY_PLOT && F().pollenEver >= APIARY_POLLEN;
export const seasonsReady = (): boolean => F().apiaryOn && F().honeyEver >= SEASONS_HONEY && F().hl.hives >= SEASONS_HIVES;

/** Opens layers whose goal was reached. Returns the one that just opened, for the UI. */
export function checkUnlocks(): 'apiary' | 'seasons' | null {
  const f = F();
  if (!f.apiaryOn && apiaryReady()) { f.apiaryOn = true; return 'apiary'; }
  if (!f.seasonsOn && seasonsReady()) { f.seasonsOn = true; return 'seasons'; }
  return null;
}

export const canHarvest = (): boolean => F().seasonsOn && F().yearPollen >= HARVEST_MIN;

/** Arm the harvest: the bees and the breeze rest, and the next tap on a ripe flower starts it. */
export function beginHarvest(): boolean {
  if (!canHarvest() || meadow.harvest !== 'off') return false;
  meadow.harvest = 'armed';
  return true;
}

export function cancelHarvest(): void {
  if (meadow.harvest === 'armed') meadow.harvest = 'off';
}

export interface HarvestResult { crops: number; flowers: number; gain: number }

/** The harvest chain was brought in: pay Harvest 🌾, then winter. */
export function finishHarvest(c: Chain): HarvestResult {
  const f = F();
  const gain = harvestGain(c.crops, f.yearPollen, f.hv.sickle);
  f.sheaves += gain;
  f.sheavesEver += gain;
  f.harvests++;
  if (gain > f.bestHarvest) f.bestHarvest = gain;
  winter();
  return { crops: c.crops, flowers: c.reaped.size, gain };
}

/**
 * Winter: the meadow, Pollen, Honey and their upgrades go; strains, the layers you opened, Harvest
 * and its upgrades stay. Harvest upgrades decide what each spring starts with.
 */
export function winter(): void {
  const f = F(), hv = f.hv, keepGenes = hv.memory > 0;
  const lv = Object.fromEntries(FL.map(u => [u.id, 0]));
  lv.plot = Math.min(PLOT_MAX - 5, hv.clearing);
  lv.breeze = Math.min(10, 2 * hv.scarecrow);
  if (keepGenes) { lv.wild = f.lv.wild; lv.vigour = f.lv.vigour; }
  f.lv = lv;
  const hl = Object.fromEntries(HL.map(u => [u.id, 0]));
  hl.hives = Math.min(f.hl.hives, hv.oldhives);
  hl.bees = Math.min(f.hl.bees, hv.oldhives, beesPerHive(3) - 1);
  if (keepGenes) hl.waggle = f.hl.waggle;
  f.hl = hl;
  f.pollen = 0;
  f.honey = 0;
  f.yearPollen = 0;
  f.honeyRate = 0;
  f.plot = f.plot.map(() => null);
  meadow.grains = [];
  meadow.harvest = 'off';
  meadow.harvestChain = null;
  meadow.breezeT = 0;
  clearBees();
}
