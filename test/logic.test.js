import test from 'node:test';
import assert from 'node:assert/strict';
import { TimingMeter } from '../src/meter.js';
import { getLevel, MAX_LEVELS } from '../src/levels.js';
import { computeStats, UPGRADES, upgradeCost } from '../src/upgrades.js';
import { Engine } from '../src/engine.js';
import { LevelSession } from '../src/session.js';
import { Progress } from '../src/save.js';

const memStore = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

test('meter zones and grades', () => {
  const m = new TimingMeter({ speed: 0.3, greenHalf: 0.15, yellowHalf: 0.3 });
  assert.equal(m.judge(0.5).grade, 'perfect');
  assert.equal(m.judge(0.5 + 0.12).grade, 'good');
  assert.equal(m.judge(0.5 + 0.25).grade, 'weak');
  const f = m.judge(0.05);
  assert.equal(f.grade, 'fail');
  assert.equal(f.side, 'early');
  assert.equal(m.judge(0.95).side, 'late');
});

test('meter sweeps 0..1 and back', () => {
  const m = new TimingMeter({ speed: 1, greenHalf: 0.1, yellowHalf: 0.2 });
  let max = 0;
  for (let i = 0; i < 200; i++) { m.update(0.01); max = Math.max(max, m.pos); }
  assert.ok(max > 0.99 && m.pos >= 0 && m.pos <= 1);
});

test('difficulty scales monotonically', () => {
  for (let n = 2; n <= MAX_LEVELS; n++) {
    const a = getLevel(n - 1), b = getLevel(n);
    assert.ok(b.meter.speed >= a.meter.speed);
    assert.ok(b.meter.greenHalf <= a.meter.greenHalf);
    assert.ok(b.bricks >= a.bricks);
  }
  assert.equal(getLevel(1).fuelEnabled, false);
  assert.equal(getLevel(3).fuelEnabled, true);
  assert.equal(getLevel(4).overheat, true);
  assert.equal(getLevel(5).filter, true);
});

test('upgrades change stats and cost grows', () => {
  const base = computeStats({});
  for (const u of UPGRADES) assert.ok(upgradeCost(u, 1) > upgradeCost(u, 0));
  const up = computeStats({ power: 3, tank: 2, cooling: 2, ladder: 2 });
  assert.ok(up.power > base.power && up.fuelCap > base.fuelCap && up.cooling > base.cooling && up.ladderSpeed > base.ladderSpeed);
});

test('throttle raises rpm, temperature and fuel use', () => {
  const lvl = getLevel(5);
  const run = (t) => {
    const e = new Engine(computeStats({}), () => 0.5);
    e.fuelOn = true; e.ignite(); e.setThrottle(t);
    for (let i = 0; i < 600; i++) e.update(0.016, lvl);
    return e;
  };
  const lo = run(0.2), hi = run(0.9);
  assert.ok(hi.rpm > lo.rpm && hi.temp > lo.temp && hi.fuel < lo.fuel);
  assert.ok(hi.outputPower(lvl) > lo.outputPower(lvl));
});

test('engine overheats and gets damaged at full throttle on hard levels', () => {
  const lvl = getLevel(10);
  const e = new Engine(computeStats({}), () => 0.5);
  e.fuelOn = true; e.ignite(); e.setThrottle(1);
  for (let i = 0; i < 3000 && e.running; i++) e.update(0.016, lvl);
  assert.ok(e.health < 100);
});

function startSession(n, upg = {}) {
  const events = [];
  const s = new LevelSession(getLevel(n), computeStats(upg), (ev) => events.push(ev), () => 0.9);
  s.setFuel(true);
  s.setThrottle(0.6);
  assert.ok(s.crankDown());
  s.crankMeter.pos = 0.5;
  s.crankUp();
  assert.ok(s.engine.running);
  assert.equal(s.phase, 'playing');
  return { s, events };
}

test('start requires fuel and sane throttle', () => {
  const s = new LevelSession(getLevel(1), computeStats({}), () => {}, () => 0.9);
  assert.equal(s.crankDown(), false);
  s.setFuel(true);
  s.setThrottle(1);
  assert.equal(s.crankDown(), false);
  s.setThrottle(0.4);
  assert.equal(s.crankDown(), true);
  s.crankMeter.pos = 0.02;
  s.crankUp();
  assert.equal(s.engine.running, false);
  assert.ok(s.lockout > 0);
});

test('perfect releases complete level 1 and award result', () => {
  const { s, events } = startSession(1);
  for (let i = 0; i < 4000 && s.phase === 'playing'; i++) {
    s.meter.pos = s.meter.center;
    if (i % 100 === 0) s.release();
    s.update(0.016);
  }
  assert.equal(s.phase, 'complete');
  assert.ok(s.result.stars >= 1 && s.result.coins > 0);
  assert.equal(s.ladderWorker.laid, s.level.bricks);
  assert.ok(events.some((e) => e.type === 'complete'));
});

test('red release hurts engine and makes ladder worker fall', () => {
  const { s } = startSession(2);
  for (let i = 0; i < 100; i++) s.update(0.016);
  s.ladderWorker.enqueue(4);
  s.ladderWorker.laid = 12;
  for (let i = 0; i < 400 && !s.ladderWorker.onLadder; i++) s.ladderWorker.update(0.016);
  assert.ok(s.ladderWorker.onLadder);
  const hp = s.engine.health;
  s.meter.pos = 0.0;
  const r = s.release();
  assert.equal(r.grade, 'fail');
  assert.ok(s.engine.health < hp);
  assert.equal(s.ladderWorker.state, 'fall');
});

test('wrecked engine and time up fail the level', () => {
  const { s } = startSession(6);
  s.engine.health = 0.5;
  s.engine.damage(5);
  s.update(0.016);
  assert.equal(s.phase, 'failed');
  const t = startSession(6).s;
  t.stat.elapsed = t.level.timeLimit + 1;
  t.update(0.016);
  assert.equal(t.failReason, 'TIME UP');
});

test('save persists progress, upgrades and coins', () => {
  const store = memStore();
  const p = new Progress(store);
  p.completeLevel(1, { coins: 70, stars: 2, score: 500 });
  assert.equal(p.buy('power').ok, true);
  assert.equal(p.buy('power').reason, 'coins');
  const q = new Progress(store);
  assert.equal(q.data.currentLevel, 2);
  assert.equal(q.data.stars[1], 2);
  assert.equal(q.upgradeLevel('power'), 1);
  assert.equal(new Progress(memStore()).buy('power').reason, 'coins');
});
