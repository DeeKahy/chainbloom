import { initAudio, tone } from '../../audio';
import type { BuyAmount } from '../../core/app';
import { $, fmt, replayClass, setClass, setHTML, setText } from '../../core/util';
import { exportSave, parseImport, replaceAndReload } from '../../state/save';
import { fresh, S } from '../../state/state';
import { currencyShop } from '../../ui/shop';
import { armed, toast } from '../../ui/toast';
import { FL, growTime, HUES, patternOf, potFactor, strainName, type Strain } from './content';
import { autoRate, compost, plotSize } from './meadow';
import { layoutPlot } from './render';

/** UI-only state (not saved). */
export const ui = {
  tool: 'plant' as 'plant' | 'dig',
  buyN: '1' as BuyAmount,
  tab: 'meadow' as 'meadow' | 'almanac',
};

const HTML = `
<div id="fstage">
  <canvas id="fcv"></canvas>
  <div id="fhud"><div id="fpollen">0</div><div id="frate"></div></div>
  <div id="fcombo"></div>
</div>
<div id="fbar">
  <div id="ftools"><button data-tool="plant" class="on">🌱 Plant</button><button data-tool="dig">⛏ Dig up</button></div>
  <div id="fseeds"></div>
  <div id="fseedInfo"></div>
</div>
<aside id="fside">
  <div id="ftabs">
    <button data-t="meadow" class="on">Meadow</button>
    <button data-t="almanac">Almanac</button>
    <button id="fmute" title="Toggle sound">♪ On</button>
  </div>
  <div class="fpane" id="fpane-meadow">
    <div class="fbox">
      <div class="fcount"><span id="fpollenCount">0</span> ✿ Pollen</div>
      <p>Plant seeds on the soil and let them grow. Tap a <b>ripe</b> flower (it glows) to make it bloom: its pollen drifts to the tiles its pattern reaches, and every ripe flower it lands on blooms too. Each bloom deeper in the chain pays more. Pollen landing on its <b>own colour</b> pays double; pollen passing between <b>different strains</b> can drop a hybrid seed.</p>
    </div>
    <div id="fbuy"><span>Buy</span><button data-n="1" class="on">×1</button><button data-n="10">×10</button><button data-n="max">Max</button></div>
    <div id="flList" class="list"></div>
    <div class="fhelp" id="fbeyond">Beyond the hedge, something hums. <b>???</b></div>
  </div>
  <div class="fpane" id="fpane-almanac" hidden>
    <div class="fstats" id="fstats"></div>
    <div class="fhelp">
      <b>Patterns:</b> a Daisy ✚ sends pollen to the four tiles beside it, a Poppy ✕ to the diagonals, a Tulip ↔ two tiles left and right, a Foxglove ↕ two up and down, an Aster ✺ all around. Rarer ones only come from mutations.<br>
      <b>Potency</b> (the dots under a flower) multiplies its Pollen, but it grows slower.<br>
      <b>Pollen that lands on an unripe flower</b> helps it grow.<br>
      Hover a flower to see where its pollen goes. Hold and drag to plant a row.<br>
      Flowers keep growing while you're away, and the Breeze keeps blooming them (at half rate), up to 2 hours.
    </div>
    <div class="fsave">
      <div class="row"><button id="fexport">Export save</button><button id="fimport">Import save</button></div>
      <textarea id="fsaveText" rows="3" spellcheck="false" placeholder="Export copies your save here (and to the clipboard). Paste one here to import."></textarea>
    </div>
    <button class="fwipe" id="fwipe">Wipe save and start over from the stars</button>
  </div>
</aside>`;

let refreshShop: () => void = () => {};
let seedsKey = '';

export function buildUi(root: HTMLElement): void {
  setHTML(root, HTML);
  // toasts are shared between eras: move the one container into this stage
  $('#fstage').appendChild($('#toasts'));

  root.querySelectorAll<HTMLButtonElement>('#ftabs button[data-t]').forEach(b => b.addEventListener('click', () => {
    ui.tab = b.dataset.t as typeof ui.tab;
    root.querySelectorAll<HTMLButtonElement>('#ftabs button[data-t]').forEach(x => x.classList.toggle('on', x === b));
    $('#fpane-meadow').hidden = ui.tab !== 'meadow';
    $('#fpane-almanac').hidden = ui.tab !== 'almanac';
    tickUi();
  }));
  root.querySelectorAll<HTMLButtonElement>('#ftools button').forEach(b => b.addEventListener('click', () => {
    ui.tool = b.dataset.tool as typeof ui.tool;
    root.querySelectorAll<HTMLButtonElement>('#ftools button').forEach(x => x.classList.toggle('on', x === b));
    refreshSeeds();
  }));
  root.querySelectorAll<HTMLButtonElement>('#fbuy button').forEach(b => b.addEventListener('click', () => {
    ui.buyN = b.dataset.n as BuyAmount;
    root.querySelectorAll<HTMLButtonElement>('#fbuy button').forEach(x => x.classList.toggle('on', x === b));
    refreshShop();
  }));
  const mute = $('#fmute');
  const muteLabel = () => setText(mute, S.mute ? '♪ Off' : '♪ On');
  muteLabel();
  mute.addEventListener('click', () => { S.mute = !S.mute; muteLabel(); initAudio(); });

  $('#fseeds').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
    if (!b) return;
    S.farm.sel = +b.dataset.id!;
    if (ui.tool !== 'plant') $<HTMLButtonElement>('#ftools button[data-tool="plant"]').click();
    refreshSeeds();
  });
  $('#fseedInfo').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('#fcompost');
    if (!b || !armed(b, 'Sure? Click again')) return;
    const s = S.farm.strains.find(x => x.id === S.farm.sel);
    if (s && compost(s.id)) toast(`${strainName(s)} went on the compost.`, '#a98260');
    refreshSeeds();
  });

  refreshShop = currencyShop({
    box: $('#flList'), defs: FL, levels: () => S.farm.lv,
    balance: () => S.farm.pollen, spend: n => { S.farm.pollen -= n; },
    cls: 'flc', unit: '✿', sound: [523, .5, 1046],
    buyN: () => ui.buyN, recalc: () => {},
    onBuy: () => { layoutPlot(); tickUi(); },
  });

  const box = $<HTMLTextAreaElement>('#fsaveText');
  $('#fexport').addEventListener('click', async () => {
    box.value = exportSave();
    box.select();
    try { await navigator.clipboard.writeText(box.value); toast('Save copied to clipboard', '#7fb85a'); }
    catch { toast('Save is in the box below: copy it from there', '#7fb85a'); }
  });
  const imp = $<HTMLButtonElement>('#fimport');
  imp.addEventListener('click', () => {
    let next;
    try { next = parseImport(box.value); }
    catch (e) { toast('Import failed: ' + (e instanceof Error ? e.message : 'invalid save'), '#d9534f'); return; }
    if (!armed(imp, 'Click again: replaces your current save')) return;
    replaceAndReload(next);
  });
  const wipe = $<HTMLButtonElement>('#fwipe');
  wipe.addEventListener('click', () => {
    if (!armed(wipe, 'Really erase everything, farm and stars? Click again')) return;
    replaceAndReload(fresh());
  });
  refreshSeeds();
}

const dotsOf = (s: Strain): string => '•'.repeat(s.pot);

export function refreshSeeds(): void {
  const f = S.farm;
  const key = f.strains.map(s => s.id).join(',') + '|' + f.sel + '|' + ui.tool;
  if (key !== seedsKey) {
    seedsKey = key;
    const sorted = [...f.strains].sort((a, b) => b.pot - a.pot || a.p.localeCompare(b.p) || a.hue - b.hue);
    setHTML($('#fseeds'), sorted.map(s =>
      `<button data-id="${s.id}" class="fseed${s.id === f.sel && ui.tool === 'plant' ? ' on' : ''}" title="${strainName(s)}">` +
      `<i style="background:${HUES[s.hue].col}"></i>${patternOf(s.p).icon}<small>${dotsOf(s)}</small></button>`).join(''));
  }
  const s = f.strains.find(x => x.id === f.sel);
  if (ui.tool === 'dig') { setHTML($('#fseedInfo'), 'Tap a flower to dig it up. Planting over a flower replaces it, too.'); return; }
  if (!s) return;
  setHTML($('#fseedInfo'),
    `<i class="fdot" style="background:${HUES[s.hue].col}"></i><b>${strainName(s)}</b> ${patternOf(s.p).icon} · potency ${s.pot} (×${fmt(potFactor(s.pot))} Pollen) · ` +
    `pollen goes to ${patternOf(s.p).desc} · ripens in ${fmt(growTime(s, f.lv.sun))}s` +
    (f.strains.length > 1 ? ` <button id="fcompost">Compost</button>` : ''));
}

let dispPollen = 0;

/** Every frame: the counting-up Pollen number. */
export function frameUi(dt: number): void {
  const p = S.farm.pollen;
  dispPollen += (p - dispPollen) * Math.min(1, dt * 8);
  if (Math.abs(p - dispPollen) < .5 || p < dispPollen) dispPollen = p;
  setText($('#fpollen'), fmt(dispPollen) + ' ✿');
}

export function tickUi(): void {
  const f = S.farm;
  const r = autoRate();
  setText($('#frate'), f.lv.breeze ? `the breeze brings ${fmt(r)} ✿ / sec` : 'tap a glowing flower');
  setText($('#fpollenCount'), fmt(f.pollen));
  if (ui.tab === 'meadow') refreshShop();
  else {
    const rows: [string, string][] = [
      ['Pollen earned', fmt(f.pollenEver)],
      ['Blooms', fmt(f.blooms)],
      ['Longest chain', `${fmt(f.bestChain)} blooms`],
      ['Best chain paid', `${fmt(f.bestPay)} ✿`],
      ['Meadow', `${plotSize()}×${plotSize()}`],
      ['Strains', `${f.strains.length} (${f.hybrids} bred)`],
      ['Highest potency', String(f.potBest)],
      ['Farming for', dur(f.playTime)],
    ];
    setHTML($('#fstats'), rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join(''));
  }
  refreshSeeds();
}

const dur = (s: number): string => s < 3600 ? `${Math.floor(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;

/** The "N BLOOM CHAIN" banner. */
export function banner(count: number): void {
  const c = $('#fcombo');
  setText(c, `${count} BLOOM CHAIN`);
  c.style.color = count >= 40 ? '#e0559a' : count >= 20 ? '#d98a1c' : '#5c9a3e';
  replayClass(c, 'go');
}

export function hybridToast(s: Strain): void {
  toast(`New seed: ${strainName(s)} ${patternOf(s.p).icon} ${dotsOf(s)}`, HUES[s.hue].col);
  initAudio();
  tone(784, .5, .05, 'triangle', 1568);
  setClass($('#fseeds'), 'newseed');
  setTimeout(() => setClass($('#fseeds'), ''), 900);
}
