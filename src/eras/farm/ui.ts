import { initAudio, tone } from '../../audio';
import type { BuyAmount } from '../../core/app';
import { $, fmt, replayClass, setClass, setHTML, setText } from '../../core/util';
import { exportSave, parseImport, replaceAndReload } from '../../state/save';
import { S } from '../../state/state';
import { currencyShop } from '../../ui/shop';
import { armed, toast } from '../../ui/toast';
import {
  APIARY_POLLEN, beesPerHive, CHAIN_FULL, FL, growTime, HARVEST_MIN, harvestGain, HL, HUES, HV, hiveCount, patternOf, potFactor,
  prosperity, SEASONS_HIVES, SEASONS_HONEY, strainName, type Strain,
} from './content';
import { autoRate, bringIn, compost, HARVEST_IDLE, meadow, plotSize } from './meadow';
import { beginHarvest, canHarvest, cancelHarvest, type HarvestResult } from './seasons';
import { layoutPlot } from './render';
import { freshFarm } from './state';

type Tab = 'meadow' | 'apiary' | 'harvest' | 'almanac';
const TABS: Tab[] = ['meadow', 'apiary', 'harvest', 'almanac'];

/** UI-only state (not saved). */
export const ui = {
  tool: 'plant' as 'plant' | 'dig',
  buyN: '1' as BuyAmount,
  tab: 'meadow' as Tab,
};

const HTML = `
<div id="fstage">
  <canvas id="fcv"></canvas>
  <div id="fhud"><div id="fpollen">0</div><div id="fhoney" hidden></div><div id="frate"></div><div id="fharvestHud" hidden></div></div>
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
    <button data-t="apiary" id="fapiaryTab" hidden>Apiary</button>
    <button data-t="harvest" id="fharvestTab" hidden>Harvest</button>
    <button data-t="almanac">Almanac</button>
    <button id="fmute" title="Toggle sound">♪ On</button>
  </div>
  <div class="fpane" id="fpane-meadow">
    <div class="fbox">
      <div class="fcount"><span id="fpollenCount">0</span> ✿ Pollen</div>
      <p>Plant seeds on the soil and let them grow. Tap a <b>ripe</b> flower (it glows) to make it bloom: its pollen drifts to the tiles its pattern reaches, and every ripe flower it lands on blooms too. Each bloom deeper in the chain pays more. Pollen landing on its <b>own colour</b> pays double; pollen passing between <b>different strains</b> can drop a hybrid seed.</p>
    </div>
    <div class="fbuy"><span>Buy</span><button data-n="1" class="on">×1</button><button data-n="10">×10</button><button data-n="max">Max</button></div>
    <div id="flList" class="list"></div>
    <div class="fhelp" id="fbeyond1"></div>
  </div>
  <div class="fpane" id="fpane-apiary" hidden>
    <div class="fbox fhoneybox">
      <div class="fcount"><span id="fhoneyCount">0</span> ⬢ Honey</div>
      <p>Hives stand on the grass around the meadow. Their bees fly to the nearest ripe flower, <b>bloom it</b> (a chain, just like a tap) and bring <b>Honey</b> home: more from flowers of higher potency. Honey buys more hives and bees, and <b>Royal Jelly</b> makes every bloom pay more Pollen. Bees keep working while you're away.</p>
      <div id="fhoneyInfo" class="finfo"></div>
    </div>
    <div class="fcat">Hives</div>
    <div id="fhives" class="list"></div>
    <div class="fbuy"><span>Buy</span><button data-n="1" class="on">×1</button><button data-n="10">×10</button><button data-n="max">Max</button></div>
    <div id="fhlList" class="list"></div>
    <div class="fhelp" id="fbeyond2"></div>
  </div>
  <div class="fpane" id="fpane-harvest" hidden>
    <div class="fbox fharvestbox">
      <div class="fcount"><span id="fsheafCount">0</span> 🌾 Harvest</div>
      <p>When the year has been good, bring in the <b>harvest</b>. The bees and the breeze rest while you wait for your flowers to ripen; then tap one to start the <b>harvest chain</b>. Every flower it reaches is brought in: each counts its potency once, however often it blooms. Then <b>winter</b> takes the meadow, Pollen, Honey and their upgrades. Your seeds, Harvest and Harvest upgrades stay.</p>
      <div id="fharvestInfo" class="finfo"></div>
      <button class="fbig" id="fharvestBtn">Begin the harvest</button>
      <button class="fbig falt" id="fbringBtn" hidden>Bring it in now</button>
    </div>
    <div class="fbuy"><span>Buy</span><button data-n="1" class="on">×1</button><button data-n="10">×10</button><button data-n="max">Max</button></div>
    <div id="fhvList" class="list"></div>
    <div class="fhelp" id="fbeyond3">Beyond the fields, a road leads to the village. <b>???</b> (not here yet)</div>
  </div>
  <div class="fpane" id="fpane-almanac" hidden>
    <div class="fstats" id="fstats"></div>
    <div class="fhelp">
      <b>Patterns:</b> a Daisy ✚ sends pollen to the four tiles beside it, a Poppy ✕ to the diagonals, a Tulip ↔ two tiles left and right, a Foxglove ↕ two up and down, an Aster ✺ all around. Rarer ones only come from mutations.<br>
      <b>Potency</b> (the dots under a flower) multiplies its Pollen, but it grows slower.<br>
      <b>Pollen that lands on an unripe flower</b> helps it grow, so a clever meadow can keep a chain going forever. The first ${CHAIN_FULL} blooms of a chain pay in full; after that each bloom pays less.<br>
      Hover a flower to see where its pollen goes. Hold and drag to plant a row.<br>
      <b>Bees</b> (Apiary) fly to the nearest ripe flower; with Waggle Dance each hive keeps to its favourite colour.<br>
      <b>Harvest</b> (Seasons): crops × prosperity, where prosperity grows with the Pollen earned this year (it starts paying at ${fmt(HARVEST_MIN)}).<br>
      Flowers keep growing while you're away, and the Breeze and the bees keep working (at half rate), up to 2 hours.
    </div>
    <div class="fsave">
      <div class="row"><button id="fexport">Export save</button><button id="fimport">Import save</button></div>
      <textarea id="fsaveText" rows="3" spellcheck="false" placeholder="Export copies your save here (and to the clipboard). Paste one here to import."></textarea>
    </div>
    <button class="fwipe" id="freset">Start the farm over (an empty meadow, no Pollen)</button>
  </div>
</aside>`;

let refreshShop: () => void = () => {};
let refreshHlShop: () => void = () => {};
let refreshHvShop: () => void = () => {};
let hivesKey = '';
let seedsKey = '';

export function buildUi(root: HTMLElement): void {
  setHTML(root, HTML);
  // toasts are shared between eras: move the one container into this stage
  $('#fstage').appendChild($('#toasts'));

  root.querySelectorAll<HTMLButtonElement>('#ftabs button[data-t]').forEach(b => b.addEventListener('click', () => {
    ui.tab = b.dataset.t as typeof ui.tab;
    root.querySelectorAll<HTMLButtonElement>('#ftabs button[data-t]').forEach(x => x.classList.toggle('on', x === b));
    for (const t of TABS) $('#fpane-' + t).hidden = ui.tab !== t;
    tickUi();
  }));
  root.querySelectorAll<HTMLButtonElement>('#ftools button').forEach(b => b.addEventListener('click', () => {
    ui.tool = b.dataset.tool as typeof ui.tool;
    root.querySelectorAll<HTMLButtonElement>('#ftools button').forEach(x => x.classList.toggle('on', x === b));
    refreshSeeds();
  }));
  // one Buy setting for every shop; all the bars show it
  root.querySelectorAll<HTMLButtonElement>('.fbuy button').forEach(b => b.addEventListener('click', () => {
    ui.buyN = b.dataset.n as BuyAmount;
    root.querySelectorAll<HTMLButtonElement>('.fbuy button').forEach(x => x.classList.toggle('on', x.dataset.n === ui.buyN));
    tickUi();
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
  refreshHlShop = currencyShop({
    box: $('#fhlList'), defs: HL, levels: () => S.farm.hl,
    balance: () => S.farm.honey, spend: n => { S.farm.honey -= n; },
    cls: 'flc', unit: '⬢', sound: [440, .5, 880],
    buyN: () => ui.buyN, recalc: () => {},
    onBuy: () => { hivesKey = ''; tickUi(); },
  });
  refreshHvShop = currencyShop({
    box: $('#fhvList'), defs: HV, levels: () => S.farm.hv,
    balance: () => S.farm.sheaves, spend: n => { S.farm.sheaves -= n; },
    cls: 'flc', unit: '🌾', sound: [392, .6, 784],
    buyN: () => ui.buyN, recalc: () => {},
    onBuy: () => tickUi(),
  });

  $('#fhives').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-hive]');
    if (!b) return;
    S.farm.hivePref[+b.dataset.hive!] = +b.dataset.pref!;
    hivesKey = '';
    refreshHives();
  });
  $('#fharvestBtn').addEventListener('click', () => {
    initAudio();
    if (meadow.harvest === 'armed') cancelHarvest();
    else if (beginHarvest()) toast('The bees stay home. Wait for your flowers to ripen, then tap one to start the harvest.', '#d99a1c');
    tickUi();
  });
  $('#fbringBtn').addEventListener('click', () => { bringIn(); tickUi(); });

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
  const reset = $<HTMLButtonElement>('#freset');
  reset.addEventListener('click', () => {
    if (!armed(reset, 'Really start the farm over? Click again')) return;
    replaceAndReload({ ...S, farm: { ...freshFarm(), since: Date.now() }, lastRate: 0 });
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
    `pollen goes to ${patternOf(s.p).desc} · ripens in ${fmt(growTime(s, f.lv.sun, f.hv.spring))}s` +
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
  $('#fapiaryTab').hidden = !f.apiaryOn;
  $('#fharvestTab').hidden = !f.seasonsOn;
  const hud = $('#fhoney');
  hud.hidden = !f.apiaryOn;
  if (f.apiaryOn) setText(hud, fmt(f.honey) + ' ⬢ honey');
  const auto = f.lv.breeze || f.apiaryOn;
  setText($('#frate'), !auto ? 'tap a glowing flower'
    : `${f.apiaryOn ? 'the bees' : 'the breeze'} bring ${fmt(autoRate())} ✿ / sec` + (f.apiaryOn ? ` · ${fmt(f.honeyRate)} ⬢ / sec` : ''));
  refreshHarvestHud();
  setText($('#fpollenCount'), fmt(f.pollen));
  if (ui.tab === 'meadow') {
    refreshShop();
    setHTML($('#fbeyond1'), f.apiaryOn ? 'Beyond the hedge: <b>the Apiary is open.</b>'
      : `Beyond the hedge, something hums. <b>???</b> Clear the meadow to 7×7 (${plotSize()}×${plotSize()}) and earn ${fmt(APIARY_POLLEN)} Pollen in all (${fmt(f.pollenEver)}).`);
  } else if (ui.tab === 'apiary') {
    setText($('#fhoneyCount'), fmt(f.honey));
    setHTML($('#fhoneyInfo'), `${hiveCount(f.hl.hives)} hive${f.hl.hives ? 's' : ''} × ${beesPerHive(f.hl.bees)} bee${f.hl.bees ? 's' : ''} · ${fmt(f.honeyRate)} ⬢ / sec`);
    refreshHives();
    refreshHlShop();
    setHTML($('#fbeyond2'), f.seasonsOn ? 'Beyond the hives: <b>the Seasons have turned.</b> See the Harvest tab.'
      : `The air is turning cooler. <b>???</b> Earn ${fmt(SEASONS_HONEY)} Honey in all (${fmt(f.honeyEver)}) and keep ${hiveCount(SEASONS_HIVES)} hives (${hiveCount(f.hl.hives)}).`);
  } else if (ui.tab === 'harvest') {
    setText($('#fsheafCount'), fmt(f.sheaves));
    const p = prosperity(f.yearPollen);
    setHTML($('#fharvestInfo'), `This year: ${fmt(f.yearPollen)} Pollen → prosperity ×${p.toFixed(2)}.<br>` +
      (canHarvest() ? `A harvest pays crops × ${fmt(harvestGain(8, f.yearPollen, f.hv.sickle) / 8)} 🌾 (rounded down): 25 Daisies would bring ${fmt(harvestGain(25, f.yearPollen, f.hv.sickle))} 🌾.`
        : `A harvest needs ${fmt(HARVEST_MIN)} Pollen this year.`));
    const btn = $<HTMLButtonElement>('#fharvestBtn');
    btn.disabled = !canHarvest() || meadow.harvest === 'running';
    setText(btn, meadow.harvest === 'armed' ? 'Not yet (call the bees back out)' : meadow.harvest === 'running' ? 'Harvesting…' : 'Begin the harvest');
    $('#fbringBtn').hidden = meadow.harvest !== 'running';
    refreshHvShop();
  } else {
    const rows: [string, string][] = [
      ['Pollen earned', fmt(f.pollenEver)],
      ['Blooms', fmt(f.blooms)],
      ['Longest chain', `${fmt(f.bestChain)} blooms`],
      ['Best chain paid', `${fmt(f.bestPay)} ✿`],
      ['Meadow', `${plotSize()}×${plotSize()}`],
      ['Strains', `${f.strains.length} (${f.hybrids} bred)`],
      ['Highest potency', String(f.potBest)],
    ];
    if (f.apiaryOn) rows.push(['Honey earned', fmt(f.honeyEver)]);
    if (f.seasonsOn) rows.push(['Harvests', String(f.harvests)], ['Harvest earned', `${fmt(f.sheavesEver)} 🌾`], ['Best harvest', `${fmt(f.bestHarvest)} 🌾`]);
    rows.push(['Farming for', dur(f.playTime)]);
    setHTML($('#fstats'), rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join(''));
  }
  refreshSeeds();
}

function refreshHarvestHud(): void {
  const el = $('#fharvestHud'), c = meadow.harvestChain;
  el.hidden = meadow.harvest === 'off';
  if (meadow.harvest === 'armed') setText(el, '🌾 Harvest: tap a ripe flower to start the harvest chain');
  else if (c) setText(el, `🌾 ${c.reaped.size} flowers, ${c.crops} crops · ${fmt(harvestGain(c.crops, S.farm.yearPollen, S.farm.hv.sickle))} 🌾 · brought in after ${Math.max(0, Math.ceil(HARVEST_IDLE - c.idle))}s without a new flower`);
}

function refreshHives(): void {
  const f = S.farm, n = hiveCount(f.hl.hives), waggle = f.hl.waggle > 0;
  const key = n + '|' + waggle + '|' + f.hivePref.join(',') + '|' + f.hl.bees;
  if (key === hivesKey) return;
  hivesKey = key;
  const rows: string[] = [];
  for (let k = 0; k < n; k++) {
    const pref = f.hivePref[k];
    const prefs = waggle ? [-1, ...HUES.map((_, i) => i)].map(h =>
      `<button data-hive="${k}" data-pref="${h}" class="${pref === h ? 'on' : ''}" title="${h < 0 ? 'Any colour' : HUES[h].name}">${h < 0 ? 'any' : `<i style="background:${HUES[h].col}"></i>`}</button>`).join('') : '';
    rows.push(`<div class="fhive"><span>Hive ${k + 1} · ${beesPerHive(f.hl.bees)} bee${f.hl.bees ? 's' : ''}</span><span class="fprefs">${prefs || '<small>visits any colour</small>'}</span></div>`);
  }
  setHTML($('#fhives'), rows.join(''));
}

/** The harvest is in: a short winter scene with the result, then spring. */
export function winterScene(r: HarvestResult): Promise<void> {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.id = 'fwinter';
    const flakes = Array.from({ length: 60 }, () =>
      `<i style="left:${Math.random() * 100}%;animation-delay:${-Math.random() * 6}s;animation-duration:${4 + Math.random() * 4}s;opacity:${.4 + Math.random() * .6}"></i>`).join('');
    box.innerHTML = `${flakes}<div class="fw1">You brought in ${r.crops} crops from ${r.flowers} flowers.<br><b>+${fmt(r.gain)} 🌾</b></div><div class="fw2">Winter. The meadow sleeps under the snow.</div><div class="fw3">…and then it is spring.</div>`;
    document.body.appendChild(box);
    initAudio();
    [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 1.4, .04, 'sine', f), i * 350));
    let done = false;
    const finish = (): void => { if (done) return; done = true; box.classList.add('out'); setTimeout(() => { box.remove(); resolve(); }, 800); };
    setTimeout(() => box.addEventListener('pointerdown', finish), 1500);
    setTimeout(finish, 6500);
  });
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
