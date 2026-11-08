import { fmt } from '../core/util';
import { RIFTS } from '../content/rifts';
import { world } from '../sim/world';
import { S } from '../state/state';
import { stat } from '../systems/stats';

/** One line of the Stats pane. The id is saved in S.pinned, so never rename one. */
export interface StatRow {
  id: string;
  label: string;
  value: () => string;
}

const lastChain = (): string => {
  const c = world.lastChain;
  return c.count ? `${fmt(c.count)} pops · depth ${c.depth} · $${fmt(c.total)}` : '-';
};

export const STAT_ROWS: StatRow[] = [
  { id: 'money', label: 'Money', value: () => '$' + fmt(S.money) },
  { id: 'runEarned', label: 'Earned this run', value: () => '$' + fmt(S.runEarned) },
  { id: 'total', label: 'Earned all time', value: () => '$' + fmt(S.total) },
  { id: 'popped', label: 'Orbs popped', value: () => fmt(S.popped) },
  { id: 'lastChain', label: 'Last chain', value: lastChain },
  { id: 'best', label: 'Biggest chain', value: () => fmt(S.best) },
  { id: 'novas', label: 'Supernovas', value: () => String(S.novas) },
  { id: 'starsEver', label: 'Stardust earned', value: () => fmt(S.starsEver) },
  { id: 'value', label: 'Orb value', value: () => fmt(stat.value) },
  { id: 'depth', label: 'Chain depth', value: () => String(stat.depth) },
  { id: 'combo', label: 'Resonance', value: () => '×' + stat.combo.toFixed(2) + ' / step' },
  { id: 'maxMult', label: 'Max chain multiplier', value: () => '×' + fmt(stat.combo ** stat.depth) },
  { id: 'orbs', label: 'Orbs on field', value: () => `${world.orbs.length} / ${stat.cap}` },
  { id: 'collapses', label: 'Collapses', value: () => String(S.collapses) },
  { id: 'dmEver', label: 'Dark Matter earned', value: () => fmt(S.dmEver) },
  { id: 'fluxEver', label: 'Flux earned', value: () => fmt(S.fluxEver) },
  { id: 'fluxMult', label: 'Flux bonus', value: () => '×' + fmt(stat.fluxMult) },
  { id: 'rifts', label: 'Rifts sealed', value: () => `${S.riftsDone.length} / ${RIFTS.length}` },
  { id: 'playTime', label: 'Play time', value: () => Math.floor(S.playTime / 3600) + 'h ' + Math.floor(S.playTime / 60 % 60) + 'm' },
];

export function togglePin(id: string): void {
  const i = S.pinned.indexOf(id);
  if (i >= 0) S.pinned.splice(i, 1); else S.pinned.push(id);
}

/** Pinned rows in the order they were pinned, skipping ids that no longer exist. */
export const pinnedRows = (): StatRow[] =>
  S.pinned.map(id => STAT_ROWS.find(r => r.id === id)).filter((r): r is StatRow => !!r);
