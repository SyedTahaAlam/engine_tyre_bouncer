import { getLevel, MAX_LEVELS } from './levels.js';
import { UPGRADES, upgradeCost, computeStats, MAX_UPGRADE } from './upgrades.js';
import { Progress } from './save.js';
import { LevelSession } from './session.js';
import { Engine } from './engine.js';
import { RATING } from './scoring.js';
import { Particles, KIND } from './particles.js';
import { AudioSystem } from './audio.js';
import { Renderer, ENGINE_COLORS, WHEEL_COLORS, HAT_COLORS, GROUND } from './render.js';

const $ = (id) => document.getElementById(id);
const progress = new Progress();
const audio = new AudioSystem();
const particles = new Particles();
const renderer = new Renderer($('scene'));
const preview = new Renderer($('preview-canvas'));

let screen = 'splash';
let session = null;
let levelNum = 1;
let previewEngine = null;
let last = performance.now();
let smokeAcc = 0, dustAcc = 0, clock = 0, resultShown = false;
const cache = {};

const FAIL_TIPS = {
  'ENGINE WRECKED': 'Red-zone releases and overheating damage the engine. Release only in GREEN and ease off the throttle when hot. Durability and cooling upgrades help.',
  'OUT OF FUEL': 'Perfect releases burn no fuel. Lower the throttle, or buy Fuel Tank / Efficiency upgrades.',
  'TIME UP': 'Keep the engine running and release as often as you can. Machine Speed and Ladder upgrades speed up the work.',
};

function setText(el, v) { if (cache[el.id] !== v) { cache[el.id] = v; el.textContent = v; } }
function setStyle(el, prop, v) { const k = `${el.id}.${prop}`; if (cache[k] !== v) { cache[k] = v; el.style[prop] = v; } }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1600); }
function vibrate(ms) { if (progress.data.settings.vibration && navigator.vibrate) navigator.vibrate(ms); }
function totalStars() { return Object.values(progress.data.stars).reduce((a, b) => a + b, 0); }

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(`screen-${id}`).classList.add('active');
  screen = id;
  if (id === 'menu') refreshMenu();
  if (id === 'levels') buildLevels();
  if (id === 'garage') buildGarage();
  if (id === 'custom') { buildCustom(); previewEngine = new Engine(computeStats(progress.data.upgrades)); previewEngine.fuelOn = true; previewEngine.ignite(); previewEngine.throttle = 0.6; requestAnimationFrame(() => preview.resize()); }
  if (id === 'settings') loadSettings();
  if (id === 'game') requestAnimationFrame(() => renderer.resize());
}
const modal = (id, open) => $(id).classList.toggle('open', open);

function refreshMenu() {
  setText($('menu-coins'), progress.data.coins);
  setText($('menu-stars'), totalStars());
  setText($('m-play-level'), `Level ${Math.min(progress.data.currentLevel, MAX_LEVELS)}`);
}

function buildLevels() {
  const g = $('level-grid');
  g.innerHTML = '';
  for (let n = 1; n <= MAX_LEVELS; n++) {
    const d = document.createElement('div');
    const unlocked = progress.isUnlocked(n);
    d.className = `lv${unlocked ? '' : ' locked'}${n === progress.data.currentLevel ? ' next' : ''}`;
    const st = progress.data.stars[n] || 0;
    d.innerHTML = unlocked ? `${n}<small>${'★'.repeat(st)}${'☆'.repeat(st ? 3 - st : 0)}</small>` : '🔒';
    d.onclick = () => { if (unlocked) { audio.play('click'); startLevel(n); } else { audio.play('deny'); toast('Complete the previous level first'); } };
    g.appendChild(d);
  }
}

function buildGarage() {
  setText($('garage-coins'), progress.data.coins);
  const list = $('upgrade-list');
  list.innerHTML = '';
  for (const u of UPGRADES) {
    const lv = progress.upgradeLevel(u.id);
    const maxed = lv >= MAX_UPGRADE;
    const el = document.createElement('div');
    el.className = 'card-up';
    const pips = Array.from({ length: MAX_UPGRADE }, (_, i) => `<span class="pip${i < lv ? ' on' : ''}"></span>`).join('');
    el.innerHTML = `<div class="ic">${u.icon}</div><b>${u.name}</b><div class="d">${u.desc}</div><div class="fx">${u.fx(lv)}${maxed ? '' : ` → ${u.fx(lv + 1)}`}</div><div class="pips">${pips}</div><button class="btn small">${maxed ? 'MAX' : `🪙 ${upgradeCost(u, lv)}`}</button>`;
    el.querySelector('button').onclick = () => {
      const r = progress.buy(u.id);
      if (r.ok) { audio.play('upgrade'); buildGarage(); }
      else { audio.play('deny'); toast(r.reason === 'coins' ? 'Not enough coins' : 'Already maxed'); }
    };
    list.appendChild(el);
  }
}

function buildCustom() {
  const list = $('custom-list');
  list.innerHTML = '';
  const rows = [['engine', 'Engine paint', ENGINE_COLORS], ['wheel', 'Wheel color', WHEEL_COLORS], ['hat', 'Helmet color', HAT_COLORS]];
  for (const [key, label, colors] of rows) {
    const r = document.createElement('div');
    r.className = 'crow';
    r.innerHTML = `<b>${label}</b><div class="sw"></div>`;
    colors.forEach((col, i) => {
      const s = document.createElement('i');
      s.style.background = col;
      if (progress.data.custom[key] === i) s.className = 'sel';
      s.onclick = () => { progress.data.custom[key] = i; progress.save(); audio.play('click'); buildCustom(); };
      r.querySelector('.sw').appendChild(s);
    });
    list.appendChild(r);
  }
}

function loadSettings() {
  const s = progress.data.settings;
  $('set-sound').checked = s.sound;
  $('set-volume').value = Math.round(s.volume * 100);
  $('set-vibration').checked = s.vibration;
  $('set-particles').value = s.particles;
}
function applySettings() {
  const s = progress.data.settings;
  audio.setSettings(s.sound, s.volume);
  particles.density = s.particles === 'low' ? 0.4 : 1;
}

/* ---------- gameplay ---------- */

function onEvent(ev) {
  if (ev.type === 'sfx') {
    audio.play(ev.name);
    if (ev.name === 'brick' && session) {
      const i = session.ladderWorker.laid - 1, lvl = session.level;
      const x = 262 + (i % lvl.cols) * lvl.bw + lvl.bw / 2, y = GROUND - (Math.floor(i / lvl.cols) + 1) * lvl.bh;
      for (let k = 0; k < 3; k++) particles.emit(KIND.DUST, x, y, (Math.random() - 0.5) * 30, -5 - Math.random() * 10, 0.7, 2);
    } else if (ev.name === 'thud') {
      for (let k = 0; k < 6; k++) particles.emit(KIND.DUST, 236, GROUND - 2, (Math.random() - 0.5) * 60, -8 - Math.random() * 14, 0.9, 3);
    } else if (ev.name === 'ignite') {
      for (let k = 0; k < 14; k++) particles.emit(KIND.SMOKE, 68, 210, (Math.random() - 0.3) * 30, -20 - Math.random() * 30, 1.6, 4);
    }
  } else if (ev.type === 'feedback') {
    const fb = $('feedback');
    fb.innerHTML = '';
    ev.lines.slice(0, 3).forEach((t, i) => {
      const d = document.createElement('div');
      d.className = `fb ${ev.kind}${i ? ' sm' : ''}`;
      d.style.animationDelay = `${i * 0.08}s`;
      d.textContent = t;
      fb.appendChild(d);
    });
  } else if (ev.type === 'release') {
    const g = $('screen-game');
    const cls = ev.grade === 'perfect' ? 'flash-perfect' : ev.grade === 'fail' ? 'flash-fail' : null;
    if (cls) { g.classList.remove('flash-perfect', 'flash-fail'); void g.offsetWidth; g.classList.add(cls); }
    if (ev.grade === 'perfect') { vibrate(25); for (let k = 0; k < 12; k++) particles.emit(KIND.SPARK, 85, 262, (Math.random() - 0.3) * 90, -40 - Math.random() * 60, 0.6, 1.5); }
    else if (ev.grade === 'fail') vibrate([60, 40, 90]);
  } else if (ev.type === 'complete') {
    progress.completeLevel(levelNum, ev.result);
    resultShown = true;
    setTimeout(() => showComplete(ev.result), 1600);
  } else if (ev.type === 'failed') {
    resultShown = true;
    setTimeout(() => showFailed(ev.reason), 1200);
  }
}

function startLevel(n) {
  levelNum = Math.min(MAX_LEVELS, Math.max(1, n));
  const lvl = getLevel(levelNum);
  session = new LevelSession(lvl, computeStats(progress.data.upgrades), onEvent);
  session.paused = true;
  resultShown = false;
  particles.life.fill(0);
  Object.keys(cache).forEach((k) => delete cache[k]);
  $('feedback').innerHTML = '';
  $('throttle').value = 40;
  session.setThrottle(0.4);
  $('hud-level').textContent = `LEVEL ${levelNum}`;
  $('g-time').hidden = !lvl.timeLimit;
  $('maint').hidden = !(lvl.filter || lvl.belt);
  $('btn-filter').hidden = !lvl.filter;
  $('btn-belt').hidden = !lvl.belt;
  $('g-fuel').style.opacity = lvl.fuelEnabled ? 1 : 0.35;
  $('g-temp').style.opacity = lvl.heatEnabled ? 1 : 0.35;
  $('i-title').textContent = `LEVEL ${levelNum}`;
  $('i-text').textContent = lvl.challenge;
  ['complete', 'failed', 'pause', 'confirm'].forEach((m) => modal(`modal-${m}`, false));
  show('game');
  modal('modal-intro', true);
}

function showComplete(r) {
  if (!session || session.phase !== 'complete') return;
  $('c-stars').innerHTML = [1, 2, 3].map((i) => `<span class="${i <= r.stars ? '' : 'off'}">★</span>`).join('');
  setText($('c-rating'), RATING[r.stars]);
  $('c-score').textContent = r.score;
  $('c-coins').textContent = `+${r.coins} 🪙`;
  $('c-counts').textContent = `${r.perfect} / ${r.good} / ${r.weak} / ${r.fail}`;
  $('c-health').textContent = `${r.health}%`;
  $('c-fuel').textContent = session.level.fuelEnabled ? `${Math.round(r.fuelFrac * 100)}%` : 'unlimited';
  $('c-time').textContent = `${Math.round(r.time)}s (par ${session.level.parTime}s)`;
  $('c-next').hidden = levelNum >= MAX_LEVELS;
  modal('modal-complete', true);
}

function showFailed(reason) {
  if (!session || session.phase !== 'failed') return;
  $('f-reason').textContent = reason;
  $('f-tip').textContent = FAIL_TIPS[reason] || '';
  modal('modal-failed', true);
}

function pause(on) {
  if (!session || !session.active) return;
  session.paused = on;
  modal('modal-pause', on);
}

function leaveGame(to) {
  session = null;
  audio.setEngine(false, 0);
  ['pause', 'complete', 'failed', 'intro'].forEach((m) => modal(`modal-${m}`, false));
  show(to);
}

function emitParticles(dt) {
  const e = session.engine;
  smokeAcc += e.smoke * 30 * dt;
  while (smokeAcc >= 1) { smokeAcc--; particles.emit(KIND.SMOKE, 68 + Math.random() * 4, 210, 5 + Math.random() * 10, -22 - Math.random() * 15, 1.5, 2.5); }
  const rate = e.rpm * 22 + (session.level.wind ? 14 : 0);
  dustAcc += rate * dt;
  while (dustAcc >= 1) {
    dustAcc--;
    if (session.level.wind && Math.random() < 0.5) particles.emit(KIND.DUST, -10, GROUND - 5 - Math.random() * 60, 70 + Math.random() * 40, -3, 3, 2.5);
    else particles.emit(KIND.DUST, 130 + Math.random() * 60, GROUND - 2, (Math.random() - 0.2) * 40, -6 - Math.random() * 10, 0.9, 2);
  }
}

function updateHud() {
  const s = session, e = s.engine, lvl = s.level;
  setText($('hud-prog-text'), `${Math.round(s.progress * 100)}%`);
  setStyle($('hud-prog-fill'), 'width', `${s.progress * 100}%`);
  setText($('hud-coins'), progress.data.coins);
  setStyle($('fuel-fill'), 'width', `${lvl.fuelEnabled ? (e.fuel / e.stats.fuelCap) * 100 : 100}%`);
  setStyle($('temp-fill'), 'width', `${Math.min(100, e.temp * 100)}%`);
  setStyle($('health-fill'), 'width', `${e.health}%`);
  $('g-temp').classList.toggle('warn', e.overheating);
  $('g-fuel').classList.toggle('warn', lvl.fuelEnabled && e.fuel / e.stats.fuelCap < 0.2);
  $('g-health').classList.toggle('warn', e.health < 30);
  if (lvl.timeLimit) setText($('time-text'), `${Math.ceil(s.timeLeft)}s`);
  setText($('rpm-text'), e.rpmValue);
  setText($('power-text'), `${Math.round((e.outputPower(lvl) / lvl.powerReq) * 100)}%`);
  setText($('chain-text'), lvl.chain ? `CHAIN ${s.chain}/${lvl.chain}` : '');
  setText($('throttle-val'), `${Math.round(e.throttle * 100)}%`);

  const m = e.running ? s.meter : s.cranking ? s.crankMeter : s.crankMeter;
  const mEl = $('meter');
  if (cache.mc !== m.center + m.greenHalf + m.yellowHalf) {
    cache.mc = m.center + m.greenHalf + m.yellowHalf;
    mEl.style.setProperty('--c', m.center); mEl.style.setProperty('--g', m.greenHalf); mEl.style.setProperty('--y', m.yellowHalf);
  }
  const pos = e.running || s.cranking ? m.pos : 0;
  $('meter-ind').style.left = `${pos * 100}%`;
  mEl.classList.toggle('in-green', (e.running || s.cranking) && m.zoneAt(pos) === 'green');
  setText($('meter-label'), s.cranking ? 'STARTER — LET GO IN THE GREEN' : e.running ? 'TIMING — RELEASE IN THE GREEN' : 'ENGINE OFF — HOLD START, LET GO IN GREEN');
  const fuelBtn = $('btn-fuel');
  fuelBtn.classList.toggle('on', e.fuelOn);
  setText(fuelBtn.querySelector('b'), e.fuelOn ? 'ON' : 'OFF');
  $('btn-start').classList.toggle('running', e.running);
  setText($('btn-start'), e.running ? 'STOP' : 'HOLD TO START');
  $('btn-release').classList.toggle('ready', e.running && m.zoneAt(pos) === 'green');
  $('btn-filter').style.opacity = s.cooldown.filter > 0 ? 0.5 : 1;
  $('btn-belt').style.opacity = s.cooldown.belt > 0 ? 0.5 : 1;

  let hint = '';
  if (s.phase === 'ready' || !e.running) {
    if (!e.fuelOn) hint = '① Turn FUEL on';
    else if (e.throttle < 0.15 || e.throttle > 0.6) hint = '② Set throttle between 15–60%';
    else hint = '③ HOLD START, let go in the GREEN';
  } else if (e.overheating) hint = '⚠ OVERHEATING — LOWER THROTTLE';
  else if (lvl.filter && e.filterDirt > 0.6) hint = '⚠ AIR FILTER DIRTY — CLEAN IT';
  else if (lvl.belt && e.beltTension < 0.4) hint = '⚠ BELT SLIPPING — TIGHTEN IT';
  else if (lvl.fuelEnabled && e.fuel / e.stats.fuelCap < 0.2) hint = '⚠ LOW FUEL';
  setText($('hint'), s.active ? hint : '');
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (screen === 'game' && session) {
    session.update(dt);
    if (!session.paused) { particles.update(dt); if (session.active || session.phase === 'complete') emitParticles(dt); }
    renderer.draw(session, particles, clock, progress.data.custom, Math.min(1, session.engine.rpm * 0.6 + (session.level.wind ? 0.4 : 0)));
    updateHud();
    audio.setEngine(session.engine.running && !session.paused, session.engine.rpm, session.engine.vibration);
  } else if (screen === 'custom' && previewEngine) {
    previewEngine.update(dt, getLevel(1));
    preview.drawPreview(previewEngine, clock, progress.data.custom);
  }
  requestAnimationFrame(frame);
}

/* ---------- input wiring ---------- */

function hold(el, down, up) {
  el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); audio.unlock(); try { el.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } down(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => el.addEventListener(n, up));
}
const click = (id, fn) => $(id).addEventListener('click', () => { audio.unlock(); audio.play('click'); fn(); });

hold($('btn-start'), () => { if (!session) return; if (session.engine.running) session.stopEngine(); else session.crankDown(); }, () => session && session.crankUp());
hold($('btn-release'), () => session && session.release(), () => {});
$('btn-fuel').addEventListener('click', () => { audio.unlock(); if (session) session.setFuel(!session.engine.fuelOn); });
$('throttle').addEventListener('input', (e) => session && session.setThrottle(e.target.value / 100));
$('btn-filter').addEventListener('click', () => session && session.cleanFilter());
$('btn-belt').addEventListener('click', () => session && session.tightenBelt());
window.addEventListener('keydown', (e) => {
  if (screen !== 'game' || !session || e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); session.release(); }
  else if (e.key === 's') { if (session.engine.running) session.stopEngine(); else session.crankDown(); }
  else if (e.key === 'f') session.setFuel(!session.engine.fuelOn);
});
window.addEventListener('keyup', (e) => { if (e.key === 's' && session) session.crankUp(); });

click('btn-pause', () => pause(true));
click('p-resume', () => pause(false));
click('p-restart', () => startLevel(levelNum));
click('p-upgrades', () => leaveGame('garage'));
click('p-settings', () => { leaveGame('settings'); });
click('p-menu', () => leaveGame('menu'));
click('i-go', () => { modal('modal-intro', false); if (session) session.paused = false; });
click('c-next', () => startLevel(levelNum + 1));
click('c-retry', () => startLevel(levelNum));
click('c-upgrades', () => leaveGame('garage'));
click('c-menu', () => leaveGame('menu'));
click('f-retry', () => startLevel(levelNum));
click('f-upgrades', () => leaveGame('garage'));
click('f-menu', () => leaveGame('menu'));
click('m-play', () => startLevel(Math.min(progress.data.currentLevel, MAX_LEVELS)));
click('m-upgrades', () => show('garage'));
click('m-levels', () => show('levels'));
click('m-custom', () => show('custom'));
click('m-settings', () => show('settings'));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { audio.play('click'); previewEngine = null; show('menu'); }));

$('set-sound').addEventListener('change', (e) => { progress.data.settings.sound = e.target.checked; progress.save(); applySettings(); });
$('set-volume').addEventListener('input', (e) => { progress.data.settings.volume = e.target.value / 100; progress.save(); applySettings(); });
$('set-vibration').addEventListener('change', (e) => { progress.data.settings.vibration = e.target.checked; progress.save(); });
$('set-particles').addEventListener('change', (e) => { progress.data.settings.particles = e.target.value; progress.save(); applySettings(); });
$('set-reset').addEventListener('click', () => modal('modal-confirm', true));
click('x-no', () => modal('modal-confirm', false));
click('x-yes', () => { progress.reset(); applySettings(); loadSettings(); modal('modal-confirm', false); toast('Progress reset'); });

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); audio.setEngine(false, 0); } });
window.addEventListener('resize', () => { if (screen === 'game') renderer.resize(); if (screen === 'custom') preview.resize(); });
window.addEventListener('contextmenu', (e) => e.preventDefault());

applySettings();
requestAnimationFrame(() => { $('splash-fill').style.width = '100%'; });
let splashDone = false;
const leaveSplash = () => { if (splashDone) return; splashDone = true; audio.unlock(); show('menu'); };
$('screen-splash').addEventListener('click', leaveSplash);
setTimeout(() => { if (screen === 'splash') leaveSplash(); }, 2200);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
requestAnimationFrame(frame);
