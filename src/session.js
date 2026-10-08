import { clamp } from './util.js';
import { TimingMeter, GRADE } from './meter.js';
import { Engine } from './engine.js';
import { OperatorWorker, LadderWorker } from './workers.js';
import { newStats, computeResult } from './scoring.js';

const BASE_BRICKS = { perfect: 4, good: 3, weak: 1, fail: 0 };
const FUEL_COST = { perfect: 0, good: 1, weak: 1.5, fail: 3 };
const THROTTLE_MIN = 0.15;
const THROTTLE_MAX = 0.6;

/** One construction job: ties engine, meters, workers and scoring together. No DOM. */
export class LevelSession {
  constructor(level, stats, emit = () => {}, rng = Math.random) {
    this.level = level;
    this.stats = stats;
    this.emit = emit;
    this.rng = rng;
    this.engine = new Engine(stats, rng);
    this.meter = new TimingMeter(level.meter, rng);
    this.meter.greenHalf *= stats.greenBonus;
    this.meter.yellowHalf += this.meter.greenHalf - level.meter.greenHalf;
    this.crankMeter = new TimingMeter({ speed: 0.45 * stats.starterSpeed, greenHalf: 0.13 * stats.starterBonus, yellowHalf: 0.13 * stats.starterBonus + 0.15, pattern: 'pingpong' }, rng);
    this.operator = new OperatorWorker();
    this.ladderWorker = new LadderWorker(level, stats, {
      onBrick: () => emit({ type: 'sfx', name: 'brick' }),
      onStep: () => emit({ type: 'sfx', name: 'ladder' }),
      onFall: () => emit({ type: 'sfx', name: 'thud' }),
      onLadderMoved: () => emit({ type: 'sfx', name: 'ladder' }),
      onPickup: () => emit({ type: 'sfx', name: 'pickup' }),
    });
    this.phase = 'ready';
    this.paused = false;
    this.cranking = false;
    this.lockout = 0;
    this.cooldown = { filter: 0, belt: 0 };
    this.chain = 0;
    this.bank = 0;
    this.produced = 0;
    this.stat = newStats();
    this.result = null;
    this.failReason = '';
    this.time = 0;
  }

  get progress() { return this.ladderWorker.laid / this.level.bricks; }
  get timeLeft() { return this.level.timeLimit ? Math.max(0, this.level.timeLimit - this.stat.elapsed) : null; }
  get active() { return this.phase === 'ready' || this.phase === 'playing'; }

  feedback(lines, kind) { this.emit({ type: 'feedback', lines, kind }); }
  sfx(name) { this.emit({ type: 'sfx', name }); }

  setThrottle(v) { if (this.active) this.engine.setThrottle(v); }

  setFuel(on) {
    if (!this.active) return;
    this.engine.fuelOn = on;
    this.sfx('click');
    if (!on && this.engine.running) this.feedback(['FUEL OFF'], 'info');
  }

  crankDown() {
    if (!this.active || this.engine.running || this.lockout > 0) return false;
    if (this.engine.health <= 0) return false;
    if (!this.engine.fuelOn) { this.feedback(['TURN FUEL ON FIRST'], 'info'); return false; }
    const t = this.engine.throttle;
    if (t < THROTTLE_MIN || t > THROTTLE_MAX) {
      this.feedback([t < THROTTLE_MIN ? 'THROTTLE TOO LOW' : 'THROTTLE TOO HIGH', 'SET 15–60%'], 'info');
      return false;
    }
    this.cranking = true;
    this.crankMeter.reset();
    this.sfx('crank');
    return true;
  }

  crankUp() {
    if (!this.cranking) return null;
    this.cranking = false;
    const j = this.crankMeter.judge();
    if (j.grade === GRADE.PERFECT || j.grade === GRADE.GOOD) {
      this.engine.ignite();
      if (this.phase === 'ready') this.phase = 'playing';
      this.operator.react('cheer', 0.9);
      this.sfx('ignite');
      this.feedback([j.grade === GRADE.PERFECT ? 'PERFECT START!' : 'ENGINE STARTED'], j.grade === GRADE.PERFECT ? 'perfect' : 'good');
    } else if (j.grade === GRADE.WEAK) {
      this.operator.react('panic', 0.8);
      this.sfx('sputter');
      this.feedback(['SPUTTERING...', j.side === 'early' ? 'TOO EARLY' : 'TOO LATE'], 'bad');
    } else {
      this.lockout = 1.2;
      this.operator.react('panic', 1.2);
      this.sfx('sputter');
      this.feedback(['FLOODED!', 'WAIT A MOMENT'], 'fail');
    }
    return j;
  }

  stopEngine() {
    if (!this.active || !this.engine.running) return;
    this.engine.stop();
    this.cranking = false;
    this.sfx('stop');
  }

  release() {
    if (this.phase !== 'playing') return null;
    const e = this.engine;
    if (!e.running) { this.feedback(['START THE ENGINE FIRST'], 'info'); return null; }
    const lvl = this.level;
    const j = this.meter.judge();
    const g = j.grade;
    this.stat[g]++;
    this.stat.releases++;
    const out = e.outputPower(lvl);
    const factor = clamp(out / lvl.powerReq, 0.2, 1.3);
    let bricks = BASE_BRICKS[g] * factor * this.stats.work;
    const lines = [];
    let kind = g;
    if (g === GRADE.PERFECT) lines.push('PERFECT!', 'POWER BONUS!', 'ENGINE EFFICIENCY +');
    else if (g === GRADE.GOOD) lines.push('GOOD!');
    else if (g === GRADE.WEAK) { lines.push('WEAK', j.side === 'early' ? 'TOO EARLY' : 'TOO LATE'); kind = 'bad'; }
    else lines.push(j.side === 'early' ? 'TOO EARLY' : 'TOO LATE');
    if (factor < 0.6 && g !== GRADE.FAIL) lines.push('LOW POWER');

    if (lvl.chain) {
      if (g === GRADE.PERFECT || g === GRADE.GOOD) {
        this.chain++;
        if (this.chain >= lvl.chain) { bricks += 2; this.chain = 0; lines.push('CHAIN BONUS!'); }
      } else this.chain = 0;
    }
    if (lvl.fuelEnabled) e.fuel = Math.max(0, e.fuel - FUEL_COST[g] * lvl.fuelRate / this.stats.fuelEff);
    e.applyLoad(g === GRADE.PERFECT ? 0.05 : 0.12);
    if (g === GRADE.WEAK) e.damage(1);

    this.bank += bricks;
    let n = Math.floor(this.bank);
    this.bank -= n;
    const remaining = lvl.bricks - this.ladderWorker.laid - this.ladderWorker.queue - this.ladderWorker.carrying;
    n = clamp(n, 0, Math.max(0, remaining));
    if (n > 0) this.ladderWorker.enqueue(n);

    this.meter.shiftCenter();
    if (g === GRADE.FAIL) {
      e.damage(12);
      e.rpm = Math.max(0, e.rpm - 0.3);
      this.ladderWorker.slip();
      this.operator.react('panic', 1.2);
      this.sfx('fail');
      if (this.rng() < 0.5 || e.rpm < 0.25) { e.stall('ENGINE STALLED'); }
    } else {
      this.operator.react('cheer', 0.6);
      this.sfx(g === GRADE.PERFECT ? 'perfect' : g === GRADE.GOOD ? 'good' : 'weak');
    }
    this.feedback(lines, kind);
    this.emit({ type: 'release', grade: g, bricks: n });
    return { ...j, bricks: n, factor };
  }

  cleanFilter() {
    if (!this.active || !this.level.filter || this.cooldown.filter > 0) return;
    this.engine.filterDirt = 0;
    this.cooldown.filter = 4;
    this.operator.react('maintain', 1.2);
    this.sfx('click');
    this.feedback(['FILTER CLEANED'], 'good');
  }

  tightenBelt() {
    if (!this.active || !this.level.belt || this.cooldown.belt > 0) return;
    this.engine.beltTension = 1;
    this.cooldown.belt = 4;
    this.operator.react('maintain', 1.2);
    this.sfx('click');
    this.feedback(['BELT TIGHTENED'], 'good');
  }

  fail(reason) {
    if (!this.active) return;
    this.phase = 'failed';
    this.failReason = reason;
    this.engine.stop();
    this.cranking = false;
    this.operator.react('panic', 99);
    this.sfx('fail');
    this.emit({ type: 'failed', reason });
  }

  complete() {
    this.phase = 'complete';
    this.cranking = false;
    this.result = computeResult(this.level, this.stat, this.engine);
    this.ladderWorker.cheer();
    this.operator.react('cheer', 99);
    this.sfx('success');
    this.emit({ type: 'complete', result: this.result });
  }

  update(dt) {
    if (this.paused) return;
    this.time += dt;
    const e = this.engine;
    e.update(dt, this.level);
    if (e.stallEvent && this.active) {
      const reason = e.health <= 0 ? 'ENGINE WRECKED' : e.stallEvent;
      e.stallEvent = null;
      this.cranking = false;
      this.sfx('stall');
      this.operator.react('stalled', 1.5);
      if (reason === 'ENGINE WRECKED') this.fail('ENGINE WRECKED');
      else if (reason === 'OUT OF FUEL') this.fail('OUT OF FUEL');
      else this.feedback([reason === 'ENGINE STALLED' ? 'ENGINE STALLED' : reason, 'RESTART THE ENGINE'], 'fail');
    }
    if (this.lockout > 0) this.lockout -= dt;
    this.cooldown.filter = Math.max(0, this.cooldown.filter - dt);
    this.cooldown.belt = Math.max(0, this.cooldown.belt - dt);
    if (this.cranking) this.crankMeter.update(dt, 1);
    if (this.phase === 'playing') {
      this.stat.elapsed += dt;
      if (e.running) this.meter.update(dt, 0.8 + 0.5 * e.rpm);
      if (this.level.timeLimit && this.stat.elapsed >= this.level.timeLimit) this.fail('TIME UP');
    }
    this.operator.update(dt, e, this.cranking);
    this.ladderWorker.update(dt);
    if (this.phase === 'playing' && this.ladderWorker.done) this.complete();
  }
}
