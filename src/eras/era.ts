/**
 * An era is a whole game of its own: its own DOM, theme, simulation, currencies and layers.
 * Chainbloom runs exactly one era at a time (`S.era`). When an era is finished, it asks for the
 * next with `requestNextEra()`; main.ts plays the next era's intro and switches over for good.
 * State from earlier eras stays in the save untouched (frozen), so a rollback still finds it.
 *
 * Adding an era:
 *  1. Make `src/eras/<name>/` with an `index.ts` whose default export is an `Era`.
 *  2. Give it a state slice in GameState (like `S.farm`) with a save migration.
 *  3. Append a loader to ERAS below. Its index is the value of `S.era`.
 *  4. Have the previous era call `requestNextEra()` when its last layer is done.
 */
export interface Era {
  /** Shown in the page title. */
  name: string;
  /** Class put on <body>: the era's colour theme hangs off it. */
  theme: string;
  /** theme-color meta (phone browser chrome). */
  chrome: string;
  /** Build or show the era's DOM and start its systems. Called once. */
  mount(): void;
  /** Simulate and draw one frame. dt is in seconds, capped at 0.05. */
  frame(dt: number): void;
  /** Slower UI-rate update (~8×/s): shops, HUD text, automation. */
  tick(): void;
  /** Income per second from automation in the era's main currency, stored with each save. */
  autoRate(): number;
  /**
   * Pay for time the game did not run: `secs` since the last save (already capped by the caller),
   * `hidden` true when only the tab was hidden (the page stayed open), false after a reload.
   * Returns a message for a toast, or null if nothing happened.
   */
  catchUp(secs: number, hidden: boolean): string | null;
  /** Optional cutscene played when this era is entered from the previous one. */
  intro?(): Promise<void>;
  /** Extra fields for the `__cb` console handle. */
  debug?: Record<string, unknown>;
}

/** Loaders in era order: `S.era` indexes this. Dynamic imports keep each era's code (and CSS) apart. */
export const ERAS: (() => Promise<{ default: Era }>)[] = [
  () => import('./space'),
  () => import('./farm'),
];

let onNext: (() => void) | null = null;

/** Set by main.ts. */
export const setNextEraHandler = (fn: () => void): void => { onNext = fn; };

/** Called by an era when its story is over: plays the next era's intro and moves on. */
export const requestNextEra = (): void => { onNext?.(); };
