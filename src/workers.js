import { REACH_ROWS } from './levels.js';

export const PILE_X = 210;
export const LADDER_X = 236;
export const WORK_X = 248;
export const LADDER_LEAN = 24;
const MOVE_TIME = 2.2;

/** Worker 1: engine / machine operator (pose state only). */
export class OperatorWorker {
  constructor() {
    this.state = 'idle';
    this.reactState = null;
    this.timer = 0;
    this.phase = 0;
  }

  react(state, dur) {
    this.reactState = state;
    this.timer = dur;
  }

  update(dt, engine, cranking) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) this.reactState = null;
    }
    this.state = this.reactState || (cranking ? 'crank' : engine.running ? 'work' : 'idle');
    this.phase += dt * (this.state === 'crank' ? 14 : 2 + engine.rpm * 10);
  }
}

/** Worker 2: ladder / construction worker. */
export class LadderWorker {
  constructor(level, stats, hooks = {}) {
    this.level = level;
    this.speed = stats.ladderSpeed;
    this.hooks = hooks;
    this.reset();
  }

  reset() {
    this.x = WORK_X;
    this.h = 0;
    this.state = 'idle';
    this.timer = 0;
    this.queue = 0;
    this.carrying = 0;
    this.laid = 0;
    this.stage = 0;
    this.pendingMove = false;
    this.ladderLen = this.stageLadderLen(0);
    this.face = 1;
    this.phase = 0;
    this.stepAcc = 0;
    this.moveProgress = 0;
  }

  stageLadderLen(s) {
    const top = Math.min((s + 1) * this.level.stageRows, this.level.rows);
    return top * this.level.bh + 14;
  }

  get row() { return Math.floor(this.laid / this.level.cols); }
  get needsClimb() { return this.row >= REACH_ROWS; }
  get done() { return this.laid >= this.level.bricks; }
  get onLadder() { return this.h > 2 && ['climb', 'place', 'descend', 'fall'].includes(this.state); }

  enqueue(n) { this.queue += n; }

  slip() {
    if (this.state === 'fall' || this.state === 'stunned' || this.done) return;
    this.queue += this.carrying;
    this.carrying = 0;
    this.pendingMove = this.pendingMove && this.state !== 'moveLadder';
    if (this.h > 2) this.state = 'fall';
    else { this.state = 'stunned'; this.timer = 0.8; this.hooks.onFall?.(); }
  }

  cheer() { this.state = 'cheer'; }

  ladderXAt(h) { return LADDER_X + (LADDER_LEAN * h) / this.ladderLen; }

  walkTo(tx, dt) {
    const step = 60 * this.speed * dt;
    const d = tx - this.x;
    if (Math.abs(d) <= step) { this.x = tx; return true; }
    this.x += Math.sign(d) * step;
    this.face = Math.sign(d);
    this.phase += dt * 10 * this.speed;
    return false;
  }

  update(dt) {
    switch (this.state) {
      case 'idle':
        this.phase += dt * 2;
        if (this.queue > 0) {
          this.carrying = Math.min(4, this.queue);
          this.queue -= this.carrying;
          this.state = 'toPile';
        }
        break;
      case 'toPile':
        if (this.walkTo(PILE_X, dt)) { this.state = 'pick'; this.timer = 0.3 / this.speed; this.face = -1; }
        break;
      case 'pick':
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'toWall'; this.hooks.onPickup?.(); }
        break;
      case 'toWall':
        if (this.walkTo(this.needsClimb ? LADDER_X : WORK_X, dt)) {
          this.face = 1;
          this.state = this.needsClimb ? 'climb' : 'place';
          this.timer = 0.15;
          if (this.needsClimb) this.hooks.onLadderUse?.();
        }
        break;
      case 'climb': {
        const target = this.climbTarget();
        this.h = Math.min(target, this.h + 38 * this.speed * dt);
        this.x = this.ladderXAt(this.h);
        this.phase += dt * 9 * this.speed;
        this.stepAcc += 38 * this.speed * dt;
        if (this.stepAcc > 9) { this.stepAcc = 0; this.hooks.onStep?.(); }
        if (this.h >= target) this.state = 'place';
        break;
      }
      case 'place':
        this.phase += dt * 6;
        this.timer -= dt;
        if (this.h > 0) {
          this.h = Math.max(this.h, Math.min(this.climbTarget(), this.h + 20 * dt));
          this.x = this.ladderXAt(this.h);
        }
        if (this.timer <= 0 && this.carrying > 0) {
          this.laid++;
          this.carrying--;
          this.timer = 0.3 / this.speed;
          this.hooks.onBrick?.(this.laid - 1);
          if (this.laid % this.level.stageBricks === 0 && this.laid < this.level.bricks && this.level.stages > 1) this.pendingMove = true;
        }
        if (this.carrying === 0 && this.timer <= 0.1) this.state = this.done ? 'done' : this.h > 0 ? 'descend' : this.afterWork();
        break;
      case 'descend':
        this.h = Math.max(0, this.h - 46 * this.speed * dt);
        this.x = this.ladderXAt(this.h);
        this.phase += dt * 9 * this.speed;
        if (this.h <= 0) { this.x = LADDER_X; this.state = this.afterWork(); }
        break;
      case 'moveLadder':
        this.timer -= dt;
        this.moveProgress = 1 - Math.max(0, this.timer) / (MOVE_TIME / this.speed);
        this.phase += dt * 5;
        if (this.timer <= 0) {
          this.stage++;
          this.ladderLen = this.stageLadderLen(this.stage);
          this.pendingMove = false;
          this.state = 'idle';
          this.hooks.onLadderMoved?.();
        }
        break;
      case 'fall':
        this.h = Math.max(0, this.h - 150 * dt);
        this.x = this.ladderXAt(this.h);
        this.phase += dt * 12;
        if (this.h <= 0) { this.state = 'stunned'; this.timer = 1.2; this.x = LADDER_X; this.hooks.onFall?.(); }
        break;
      case 'stunned':
        this.timer -= dt;
        this.phase += dt * 4;
        if (this.timer <= 0) this.state = this.afterWork();
        break;
      default:
        this.phase += dt * 6;
    }
  }

  afterWork() {
    if (this.pendingMove) { this.state = 'moveLadder'; this.timer = MOVE_TIME / this.speed; this.moveProgress = 0; return 'moveLadder'; }
    return 'idle';
  }

  climbTarget() { return Math.min(this.ladderLen - 4, Math.max(10, this.row * this.level.bh - 6)); }
}
