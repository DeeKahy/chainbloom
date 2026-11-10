import './style.css';
import { $ } from './core/util';
import { ERAS, setNextEraHandler, type Era } from './eras/era';
import { dropSpaceBackups, load, save } from './state/save';
import { dropEarlierEras, S } from './state/state';
import { toast } from './ui/toast';

/**
 * Boot and main loop, shared by every era. Everything game-specific lives in the era module
 * (src/eras/<name>/): main.ts only loads the current one, runs its frame/tick, saves, and pays
 * for time the game did not run.
 */

const UI_INTERVAL = .12;
const SAVE_INTERVAL = 5;
/** Longest stretch of missed time an era is paid for. */
const CATCH_UP_MAX = 7200;

let era: Era;
/** Set while a transition between eras plays: the old era stops updating. */
let switching = false;

async function startEra(index: number): Promise<Era> {
  const e = (await ERAS[index]()).default;
  if (index > 0) { dropEarlierEras(); dropSpaceBackups(); }
  document.body.classList.add(e.theme);
  document.title = e.name;
  $<HTMLMetaElement>('meta[name="theme-color"]').content = e.chrome;
  e.mount();
  // descriptors, not a spread, so the era's debug getters/setters (e.g. space's `paused`) stay live
  (window as unknown as Record<string, unknown>).__cb = Object.defineProperties({ S, era: e }, Object.getOwnPropertyDescriptors(e.debug ?? {}));
  return e;
}

/** The current era is over: play the next one's intro, then switch for good. */
async function nextEra(): Promise<void> {
  if (switching || S.era + 1 >= ERAS.length) return;
  switching = true;
  save(era.autoRate());
  const next = (await ERAS[S.era + 1]()).default;
  await next.intro?.();
  S.era++;
  dropEarlierEras();
  S.saved = Date.now();
  save(0);
  // The old era's DOM, listeners and GPU state are simplest to drop with the page itself.
  location.reload();
}

function catchUp(hidden: boolean): void {
  if (!S.saved) return;
  const secs = Math.min(CATCH_UP_MAX, (Date.now() - S.saved) / 1000);
  if (secs <= 0) return;
  const msg = era.catchUp(secs, hidden);
  if (msg) setTimeout(() => toast(msg, '#ffd34d'), hidden ? 0 : 400);
  // moves S.saved forward so the same time can't be paid twice
  save(era.autoRate());
}

async function boot(): Promise<void> {
  load();
  setNextEraHandler(() => { void nextEra(); });
  era = await startEra(Math.min(S.era, ERAS.length - 1));
  catchUp(false);

  let last = performance.now(), uiT = 0, saveT = 0;
  const frame = (now: number): void => {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if (!switching) {
      era.frame(dt);
      uiT += dt; saveT += dt;
      if (uiT > UI_INTERVAL) { uiT = 0; era.tick(); }
      if (saveT > SAVE_INTERVAL) { saveT = 0; save(era.autoRate()); }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => { if (!switching) save(era.autoRate()); });
  document.addEventListener('visibilitychange', () => {
    if (switching) return;
    if (document.hidden) save(era.autoRate());
    // The browser stops the loop in a hidden tab: pay for that time on return.
    else catchUp(true);
  });
}

void boot();
