const SMOKE = 0, DUST = 1, SPARK = 2;
export const KIND = { SMOKE, DUST, SPARK };

/** Fixed-size pooled particle system (no per-frame allocation). */
export class Particles {
  constructor(n = 220) {
    this.n = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.size = new Float32Array(n);
    this.kind = new Uint8Array(n);
    this.cursor = 0;
    this.density = 1;
  }

  emit(kind, x, y, vx, vy, life, size) {
    if (this.density < 1 && Math.random() > this.density) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.kind[i] = kind;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      const k = this.kind[i];
      if (k === SPARK) this.vy[i] += 160 * dt;
      else { this.vx[i] *= 1 - 0.6 * dt; this.size[i] += (k === SMOKE ? 7 : 4) * dt; }
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i];
      if (l <= 0) continue;
      const a = l / this.max[i];
      const k = this.kind[i];
      if (k === SMOKE) ctx.fillStyle = `rgba(70,65,60,${(0.45 * a).toFixed(3)})`;
      else if (k === DUST) ctx.fillStyle = `rgba(214,175,118,${(0.4 * a).toFixed(3)})`;
      else ctx.fillStyle = `rgba(255,${Math.round(120 + 120 * a)},60,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(this.x[i], this.y[i], this.size[i], 0, 6.2832);
      ctx.fill();
    }
  }
}
