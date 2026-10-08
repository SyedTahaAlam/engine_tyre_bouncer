import { PILE_X, LADDER_X, LADDER_LEAN } from './workers.js';

export const W = 360;
export const H = 330;
export const GROUND = 300;
const WALL_X = 262;

export const ENGINE_COLORS = ['#b8372c', '#2f7d4f', '#2f62a8', '#d98a1f', '#6d6b3a'];
export const WHEEL_COLORS = ['#6b6f75', '#8a4b2a', '#3d4650', '#a58a3a', '#4b6b6e'];
export const HAT_COLORS = ['#f2c230', '#e8e8e8', '#e0702a', '#3f8fd2', '#5aa05a'];
const BRICK_COLORS = ['#b5562f', '#a84b2a', '#c26238', '#9e4526'];

const EX = 30; // engine block origin
const FLY = { x: 100, y: 274, r: 20 };
const WHEEL = { x: 160, y: 250, r: 40 };

function pseudo(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1; this.ox = 0; this.oy = 0; this.dpr = 1; this.w = 1; this.h = 1;
    this.dots = Array.from({ length: 60 }, (_, i) => [pseudo(i) * W, GROUND + 6 + pseudo(i + 99) * 40, 1 + pseudo(i + 5) * 2]);
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.scale = Math.min(this.w / W, this.h / H);
    this.ox = (this.w - W * this.scale) / 2;
    this.oy = (this.h - H * this.scale) * 0.55;
  }

  begin() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.translate(this.ox, this.oy);
    c.scale(this.scale, this.scale);
    this.x0 = -this.ox / this.scale;
    this.x1 = (this.w - this.ox) / this.scale;
    this.y0 = -this.oy / this.scale;
  }

  background(t, dust = 0) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, this.y0, 0, GROUND);
    g.addColorStop(0, '#e9b97a'); g.addColorStop(0.6, '#f5d9a6'); g.addColorStop(1, '#f7e3bb');
    c.fillStyle = g;
    c.fillRect(this.x0, this.y0, this.x1 - this.x0, GROUND - this.y0);
    c.fillStyle = 'rgba(255,240,190,0.7)';
    c.beginPath(); c.arc(290, 60, 26, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(255,240,190,0.25)';
    c.beginPath(); c.arc(290, 60, 46, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(255,248,230,0.55)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 97 + t * (4 + i * 1.5)) % (W + 160)) - 80, cy = Math.max(this.y0 + 40, 30) + i * 38;
      for (const [dx, dy, r] of [[0, 0, 16], [16, -5, 20], [36, 0, 15], [18, 5, 14]]) { c.beginPath(); c.arc(cx + dx, cy + dy, r, 0, 6.3); c.fill(); }
    }
    c.strokeStyle = '#5a4030'; c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const bx = ((t * 20 + i * 70) % (W + 40)) - 20, by = Math.max(this.y0 + 70, 70) + i * 22 + Math.sin(t * 2 + i) * 3, f = Math.sin(t * 8 + i) * 2;
      c.beginPath(); c.moveTo(bx - 5, by - f); c.quadraticCurveTo(bx - 2, by - 3, bx, by); c.quadraticCurveTo(bx + 2, by - 3, bx + 5, by - f); c.stroke();
    }
    c.fillStyle = '#d3a574';
    c.beginPath(); c.moveTo(this.x0, GROUND - 40);
    for (let x = this.x0; x <= this.x1; x += 30) c.lineTo(x, GROUND - 52 - Math.sin(x * 0.03) * 12);
    c.lineTo(this.x1, GROUND); c.lineTo(this.x0, GROUND); c.fill();
    const b = [[-30, 55, 50], [26, 42, 40], [70, 60, 36], [290, 45, 54], [330, 62, 48]];
    c.fillStyle = '#b98a5a';
    for (const [x, h, w] of b) { c.fillRect(x, GROUND - h - 4, w, h); }
    c.fillStyle = '#7b5233';
    for (const [x, h] of b) { c.fillRect(x + 8, GROUND - h + 6, 7, 9); c.fillRect(x + 24, GROUND - h + 6, 7, 9); }
    c.strokeStyle = '#6b4a2c'; c.lineWidth = 2;
    for (const x of [248, 20]) {
      c.beginPath(); c.moveTo(x, GROUND - 4); c.lineTo(x + 2, GROUND - 56); c.stroke();
      c.fillStyle = '#6d7b3c';
      c.beginPath(); c.arc(x + 2, GROUND - 60, 11, 0, 6.3); c.fill();
    }
    c.fillStyle = '#b8864f';
    c.fillRect(this.x0, GROUND, this.x1 - this.x0, 2000);
    c.fillStyle = '#a5743f';
    c.fillRect(this.x0, GROUND, this.x1 - this.x0, 6);
    c.fillStyle = 'rgba(120,80,40,0.35)';
    for (const [x, y, r] of this.dots) c.fillRect(x, y, r * 2, r);
  }

  wall(session) {
    const c = this.ctx, lvl = session.level, wk = session.ladderWorker;
    const BRICK_W = lvl.bw, BRICK_H = lvl.bh;
    const w = lvl.cols * BRICK_W, h = lvl.rows * BRICK_H;
    c.fillStyle = 'rgba(80,50,20,0.10)';
    c.fillRect(WALL_X, GROUND - h, w, h);
    c.setLineDash([3, 3]); c.strokeStyle = 'rgba(80,50,20,0.45)'; c.lineWidth = 1;
    c.strokeRect(WALL_X, GROUND - h, w, h);
    c.setLineDash([]);
    if (lvl.stages > 1) {
      c.strokeStyle = 'rgba(80,50,20,0.3)';
      for (let s = 1; s < lvl.stages; s++) {
        const y = GROUND - s * lvl.stageRows * BRICK_H;
        c.beginPath(); c.moveTo(WALL_X, y); c.lineTo(WALL_X + w, y); c.stroke();
      }
    }
    for (let i = 0; i < wk.laid; i++) {
      const col = i % lvl.cols, row = Math.floor(i / lvl.cols);
      c.fillStyle = BRICK_COLORS[Math.floor(pseudo(i) * 4)];
      c.fillRect(WALL_X + col * BRICK_W, GROUND - (row + 1) * BRICK_H, BRICK_W - 0.8, BRICK_H - 0.8);
    }
  }

  ladder(wk) {
    const c = this.ctx;
    const len = wk.ladderLen;
    let bx = LADDER_X, by = GROUND, tx = LADDER_X + LADDER_LEAN, ty = GROUND - len;
    if (wk.state === 'moveLadder') {
      const p = wk.moveProgress;
      const lift = Math.sin(Math.min(1, p) * Math.PI);
      bx = LADDER_X - 14 * lift; tx = bx + LADDER_LEAN + 20 * lift; by = GROUND - 6 * lift; ty = GROUND - len + 40 * lift;
    }
    c.strokeStyle = '#7a4a21'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(bx - 3, by); c.lineTo(tx - 3, ty); c.moveTo(bx + 3, by); c.lineTo(tx + 3, ty); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = '#9a6330';
    const n = Math.floor(len / 9);
    for (let i = 1; i <= n; i++) {
      const f = i / (n + 0.5);
      const x = bx + (tx - bx) * f, y = by + (ty - by) * f;
      c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.stroke();
    }
  }

  pile() {
    const c = this.ctx;
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) {
      c.fillStyle = BRICK_COLORS[(r + i) % 4];
      c.fillRect(PILE_X - 14 + i * 10 + r * 5, GROUND - (r + 1) * 6, 9.2, 5.2);
    }
  }

  person(x, y, o, hat) {
    const c = this.ctx;
    const face = o.face || 1;
    c.save();
    c.translate(x, y);
    if (o.rot) { c.translate(0, -16); c.rotate(o.rot); c.translate(0, 16); }
    const legs = o.legs || [0.1, -0.1];
    const arms = o.arms || [0.3, 0.2];
    const hipY = -14, shY = -29;
    c.lineCap = 'round';
    c.strokeStyle = '#3b4a63'; c.lineWidth = 4;
    for (const a of legs) { c.beginPath(); c.moveTo(0, hipY); c.lineTo(face * Math.sin(a) * 13, hipY + Math.cos(a) * 14); c.stroke(); }
    c.strokeStyle = o.shirt || '#c9482f'; c.lineWidth = 9;
    c.beginPath(); c.moveTo(0, hipY); c.lineTo(0, shY); c.stroke();
    c.lineWidth = 3.4; c.strokeStyle = '#c68b59';
    const hands = [];
    for (const a of arms) {
      const ex = face * Math.sin(a) * 13, ey = shY + 1 + Math.cos(a) * 13;
      c.beginPath(); c.moveTo(0, shY + 1); c.lineTo(ex, ey); c.stroke();
      hands.push([ex, ey]);
    }
    if (o.carry) {
      const [hx, hy] = hands[0];
      for (let i = 0; i < Math.min(4, o.carry); i++) {
        c.fillStyle = BRICK_COLORS[i % 4];
        c.fillRect(hx + face * 2 - 5, hy - 4 - i * 4.5, 10, 4);
      }
    }
    c.fillStyle = '#c68b59';
    c.beginPath(); c.arc(0, shY - 8, 5.2, 0, 6.3); c.fill();
    c.fillStyle = hat;
    c.beginPath(); c.arc(0, shY - 9, 5.8, Math.PI, 0); c.fill();
    c.fillRect(-6.5, shY - 9.5, 13, 2);
    if (o.dizzy) {
      c.fillStyle = '#ffe14a';
      for (let i = 0; i < 3; i++) {
        const a = o.t * 4 + i * 2.1;
        c.fillRect(Math.cos(a) * 9 - 1.5, shY - 22 + Math.sin(a) * 3, 3, 3);
      }
    }
    c.restore();
  }

  ladderWorker(wk, hat, t) {
    const s = wk.state, ph = wk.phase;
    const sw = Math.sin(ph);
    const o = { face: wk.face, shirt: '#3e7dbd', t };
    let x = wk.x, y = GROUND - wk.h;
    switch (s) {
      case 'toPile': case 'toWall': case 'moveLadder':
        o.legs = [sw * 0.6, -sw * 0.6]; o.arms = s === 'toWall' && wk.carrying ? [1.3, 1.3] : [-sw * 0.5, sw * 0.5];
        o.carry = s === 'toWall' ? wk.carrying : 0;
        if (s === 'moveLadder') o.arms = [2.2, 2.2];
        break;
      case 'climb': case 'descend': o.face = 1; o.legs = [sw * 0.5, -sw * 0.5]; o.arms = [2.6 + sw * 0.4, 2.6 - sw * 0.4]; o.carry = wk.carrying; break;
      case 'place': o.face = 1; o.legs = [0.15, -0.15]; o.arms = [1.4 + Math.sin(ph * 3) * 0.4, 0.8]; o.carry = 0; break;
      case 'pick': o.legs = [0.3, -0.3]; o.arms = [0.4, 0.4]; y += 2; break;
      case 'fall': o.rot = ph * 0.8; o.arms = [2.4, -2.4]; o.legs = [1, -1]; break;
      case 'stunned': o.legs = [0.5, -0.5]; o.arms = [0.3, 0.3]; o.dizzy = true; y += 2; break;
      case 'cheer': case 'done': o.arms = [2.8 + Math.sin(ph * 2) * 0.3, 2.8 - Math.sin(ph * 2) * 0.3]; o.legs = [0.2, -0.2]; y -= Math.abs(Math.sin(ph)) * 4; break;
      default: o.legs = [0.1, -0.1]; o.arms = [0.3, 0.1 + sw * 0.05];
    }
    this.person(x, y, o, hat);
  }

  operator(op, e, hat, t) {
    const x = 18, y = GROUND;
    const sw = Math.sin(op.phase);
    const o = { face: 1, shirt: '#d9a02c', t };
    switch (op.state) {
      case 'work': o.arms = [1.2 + sw * 0.35, 1.5]; o.legs = [0.15, -0.1]; break;
      case 'crank': o.arms = [1.2 + sw * 0.8, 1.0 - sw * 0.6]; o.legs = [0.3, -0.2]; break;
      case 'cheer': o.arms = [2.8 + sw * 0.3, 2.8 - sw * 0.3]; o.legs = [0.2, -0.2]; break;
      case 'panic': o.arms = [2.9, 2.9]; o.legs = [0.4 + sw * 0.1, -0.3]; break;
      case 'stalled': o.arms = [1.9, 1.9]; o.legs = [0.2, -0.2]; break;
      case 'maintain': o.arms = [1.3 + Math.sin(op.phase * 2) * 0.4, 0.9]; break;
      default: o.arms = [0.9, 0.4]; o.legs = [0.1, -0.1];
    }
    this.person(x, y + (op.state === 'cheer' ? -Math.abs(sw) * 3 : 0), o, hat);
  }

  belt(e, t) {
    const c = this.ctx;
    const a = FLY, b = { x: WHEEL.x, y: WHEEL.y, r: 14 };
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const phi = Math.acos((a.r - b.r) / d);
    const pts = (s) => [
      [a.x + a.r * Math.cos(ang + s * phi), a.y + a.r * Math.sin(ang + s * phi)],
      [b.x + b.r * Math.cos(ang + s * phi), b.y + b.r * Math.sin(ang + s * phi)],
    ];
    const p1 = pts(1), p2 = pts(-1);
    c.strokeStyle = '#2a2623'; c.lineWidth = 3.6;
    c.beginPath(); c.moveTo(...p1[0]); c.lineTo(...p1[1]); c.moveTo(...p2[0]); c.lineTo(...p2[1]); c.stroke();
    c.strokeStyle = '#6a625a'; c.lineWidth = 1.2; c.setLineDash([4, 5]); c.lineDashOffset = -e.wheelAngle * 10;
    c.beginPath(); c.moveTo(...p1[0]); c.lineTo(...p1[1]); c.moveTo(...p2[0]); c.lineTo(...p2[1]); c.stroke();
    c.setLineDash([]);
  }

  disc(cx, cy, r, ang, color, spokes) {
    const c = this.ctx;
    c.fillStyle = '#2a2623'; c.beginPath(); c.arc(cx, cy, r, 0, 6.3); c.fill();
    c.fillStyle = color; c.beginPath(); c.arc(cx, cy, r - 3, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(cx, cy, r - 8, 0, 6.3); c.fill();
    c.strokeStyle = '#1f1c1a'; c.lineWidth = 2.4;
    for (let i = 0; i < spokes; i++) {
      const a = ang + (i * 6.2832) / spokes;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); c.stroke();
    }
    c.fillStyle = '#cfc7b8'; c.beginPath(); c.arc(cx + Math.cos(ang) * (r - 7), cy + Math.sin(ang) * (r - 7), 2.2, 0, 6.3); c.fill();
    c.fillStyle = '#4b4540'; c.beginPath(); c.arc(cx, cy, 5, 0, 6.3); c.fill();
  }

  engine(e, t, custom) {
    const c = this.ctx;
    const sx = (Math.random() - 0.5) * e.vibration * 2.2, sy = (Math.random() - 0.5) * e.vibration * 2.2;
    c.save();
    c.translate(sx, sy);
    this.disc(WHEEL.x, WHEEL.y, WHEEL.r, e.wheelAngle, WHEEL_COLORS[custom.wheel] || WHEEL_COLORS[0], 8);
    c.fillStyle = '#4a433d'; c.fillRect(WHEEL.x - 3, WHEEL.y, 6, GROUND - WHEEL.y);
    c.fillRect(WHEEL.x - 18, GROUND - 4, 36, 4);
    this.belt(e, t);
    const col = ENGINE_COLORS[custom.engine] || ENGINE_COLORS[0];
    c.fillStyle = '#4a3d33'; c.fillRect(EX - 8, GROUND - 8, 92, 8);
    c.fillStyle = col; c.fillRect(EX, 262, 52, 30);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(EX, 262, 52, 5);
    if (e.temp > 0.7) { c.fillStyle = `rgba(255,70,20,${Math.min(0.45, (e.temp - 0.7) * 1.5)})`; c.fillRect(EX, 262, 52, 30); }
    c.fillStyle = '#3b3733'; c.fillRect(EX + 10, 232, 24, 30);
    c.fillStyle = '#4b4540';
    for (let i = 0; i < 4; i++) c.fillRect(EX + 7, 236 + i * 6, 30, 2.5);
    const py = 242 + Math.sin(e.crankAngle) * 5;
    c.fillStyle = '#a9a39a'; c.fillRect(EX + 14, py, 16, 8);
    c.strokeStyle = '#8a847a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(EX + 22, py + 8); c.lineTo(FLY.x - 24 + Math.cos(e.crankAngle) * 6, 274 + Math.sin(e.crankAngle) * 6); c.stroke();
    c.fillStyle = '#2a2623'; c.fillRect(EX + 36, 214, 5, 22); c.fillRect(EX + 33, 212, 11, 4);
    c.fillStyle = '#d6d0c4'; c.beginPath(); c.arc(EX + 4, 276, 7, 0, 6.3); c.fill();
    c.strokeStyle = '#333'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(EX + 4, 276); c.lineTo(EX + 4 + Math.cos(-2.4 + e.rpm * 3.6) * 6, 276 + Math.sin(-2.4 + e.rpm * 3.6) * 6); c.stroke();
    c.fillStyle = '#4a3d33'; c.fillRect(EX + 40, 270, 10, 12);
    this.disc(FLY.x, FLY.y, FLY.r, e.crankAngle, '#5c5750', 4);
    c.restore();
  }

  dustHaze(dust, t) {
    const c = this.ctx;
    c.fillStyle = `rgba(226,180,110,${0.1 + dust * 0.12})`;
    c.fillRect(this.x0, this.y0, this.x1 - this.x0, GROUND - this.y0 + 200);
    const g = c.createRadialGradient(290, 60, 10, 290, 60, 300);
    g.addColorStop(0, 'rgba(255,230,160,0.25)'); g.addColorStop(1, 'rgba(60,30,10,0.18)');
    c.fillStyle = g;
    c.fillRect(this.x0, this.y0, this.x1 - this.x0, GROUND - this.y0 + 200);
  }

  draw(session, particles, t, custom, dust = 0) {
    this.begin();
    this.background(t, dust);
    this.wall(session);
    this.pile();
    this.ladder(session.ladderWorker);
    this.ladderWorker(session.ladderWorker, HAT_COLORS[custom.hat] || HAT_COLORS[0], t);
    this.engine(session.engine, t, custom);
    this.operator(session.operator, session.engine, HAT_COLORS[custom.hat] || HAT_COLORS[0], t);
    particles.draw(this.ctx);
    this.dustHaze(dust, t);
  }

  /** Engine-only preview for the customization screen. */
  drawPreview(engine, t, custom) {
    this.begin();
    this.background(t);
    this.engine(engine, t, custom);
    this.operator({ state: 'work', phase: t * 5 }, engine, HAT_COLORS[custom.hat] || HAT_COLORS[0], t);
    this.dustHaze(0.2, t);
  }
}
