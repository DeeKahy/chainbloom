/** UI-level state shared between modules (not saved). */
export type View = 'orbs' | 'board';
export type Tab = 'up' | 'nova' | 'col' | 'sing' | 'stats';
export type BuyAmount = '1' | '10' | 'max';

export const app = {
  view: 'orbs' as View,
  tab: 'up' as Tab,
  buyN: '1' as BuyAmount,
};

/**
 * Tiny refresh bus: systems that change the game (prestige, rifts, wipe) call refreshAll(),
 * and each UI pane registers its own refresher. Keeps game logic free of DOM imports.
 */
const refreshers = new Set<() => void>();
export const onRefresh = (fn: () => void): void => { refreshers.add(fn); };
export const refreshAll = (): void => { refreshers.forEach(fn => fn()); };

/** Game time in seconds since the page loaded (advances only while the game updates). */
export const clock = { T: 0 };
