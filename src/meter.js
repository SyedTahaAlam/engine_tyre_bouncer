import { clamp } from './util.js';

export const GRADE = { PERFECT: 'perfect', GOOD: 'good', WEAK: 'weak', FAIL: 'fail' };

const tri = (p) => {
  const m = ((p % 2) + 2) % 2;
  return m < 1 ? m : 2 - m;
};

/**
 * Timing meter. The indicator sweeps 0..1 (RED -> YELLOW -> GREEN -> YELLOW -> RED).
 * speed is in full left-right-left cycles per second.
 */
export class TimingMeter {
  constructor(cfg, rng = Math.random) {
    this.rng = rng;
    this.perfectRatio = 0.35;
    this.configure(cfg);
    this.reset();
  }

  configure(cfg) {
    this.speed = cfg.speed;
    this.greenHalf = cfg.greenHalf;
    this.yellowHalf = cfg.yellowHalf;
    this.pattern = cfg.pattern || 'pingpong';
    this.variation = cfg.variation || 0;
    this.drift = !!cfg.drift;
    this.center = cfg.center ?? 0.5;
  }

  reset() {
    this.phase = 0;
    this.time = 0;
    this.seed = this.rng() * 6.28;
    this.pos = 0;
  }

  update(dt, speedMul = 1) {
    this.time += dt;
    let mod = 1;
    if (this.variation) {
      mod = 1 + this.variation * Math.sin(this.time * 2.7 + this.seed) * Math.sin(this.time * 1.3);
    }
    this.phase += 2 * this.speed * speedMul * mod * dt;
    if (this.pattern === 'sine') this.pos = 0.5 - 0.5 * Math.cos(Math.PI * this.phase);
    else if (this.pattern === 'surge') this.pos = tri(this.phase + 0.18 * Math.sin(this.phase * 3.1 + this.seed));
    else this.pos = tri(this.phase);
    return this.pos;
  }

  zoneAt(pos = this.pos) {
    const d = Math.abs(pos - this.center);
    if (d <= this.greenHalf) return 'green';
    if (d <= this.yellowHalf) return 'yellow';
    return 'red';
  }

  judge(pos = this.pos) {
    const d = Math.abs(pos - this.center);
    const side = pos < this.center ? 'early' : 'late';
    if (d <= this.greenHalf * this.perfectRatio) return { grade: GRADE.PERFECT, zone: 'green', side, accuracy: 1 - d / this.greenHalf };
    if (d <= this.greenHalf) return { grade: GRADE.GOOD, zone: 'green', side, accuracy: 1 - d / this.greenHalf };
    if (d <= this.yellowHalf) return { grade: GRADE.WEAK, zone: 'yellow', side, accuracy: 0 };
    return { grade: GRADE.FAIL, zone: 'red', side, accuracy: 0 };
  }

  shiftCenter() {
    if (!this.drift) return;
    const lo = this.yellowHalf;
    this.center = clamp(0.3 + this.rng() * 0.4, lo, 1 - lo);
  }
}
