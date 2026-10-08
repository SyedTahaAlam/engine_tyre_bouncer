/** WebAudio synthesiser: RPM-reactive engine loop + procedural sound effects. */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.7;
  }

  setSettings(enabled, volume) {
    this.enabled = enabled;
    this.volume = volume;
    if (this.master) this.master.gain.value = enabled ? volume : 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this.makeNoise();
      this.buildEngine();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  makeNoise() {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  buildEngine() {
    const c = this.ctx;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'square';
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass';
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.lfo = c.createOscillator(); this.lfo.type = 'square';
    this.lfoGain = c.createGain(); this.lfoGain.gain.value = 0;
    const sub = c.createGain(); sub.gain.value = 0.5;
    this.o1.connect(this.filter); this.o2.connect(sub); sub.connect(this.filter);
    this.filter.connect(this.engGain); this.engGain.connect(this.master);
    this.lfo.connect(this.lfoGain); this.lfoGain.connect(this.engGain.gain);
    this.belt = c.createBufferSource(); this.belt.buffer = this.noiseBuf; this.belt.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 1.5;
    this.beltGain = c.createGain(); this.beltGain.gain.value = 0;
    this.belt.connect(bp); bp.connect(this.beltGain); this.beltGain.connect(this.master);
    [this.o1, this.o2, this.lfo, this.belt].forEach((n) => n.start());
  }

  /** Called every frame. rpm 0..1, vibration 0..1.5 */
  setEngine(running, rpm, vibration = 0) {
    if (!this.ctx || !this.engGain) return;
    const t = this.ctx.currentTime;
    const base = running ? 0.07 + 0.13 * rpm : 0;
    this.engGain.gain.setTargetAtTime(base, t, 0.05);
    this.lfoGain.gain.setTargetAtTime(base * 0.55, t, 0.05);
    const f = 36 + rpm * 80 + vibration * 4;
    this.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.o2.frequency.setTargetAtTime(f / 2, t, 0.05);
    this.filter.frequency.setTargetAtTime(260 + rpm * 1100, t, 0.08);
    this.lfo.frequency.setTargetAtTime(4 + rpm * 24, t, 0.05);
    this.beltGain.gain.setTargetAtTime(running ? 0.01 + rpm * 0.05 : 0, t, 0.1);
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, vol = 0.2, freq = 1000, type = 'bandpass', delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  play(name) {
    switch (name) {
      case 'click': this.tone(520, 0.06, 'square', 0.08); break;
      case 'crank': this.noise(0.5, 0.15, 400); this.tone(70, 0.5, 'sawtooth', 0.1, 30); break;
      case 'ignite': this.noise(0.4, 0.3, 300, 'lowpass'); this.tone(60, 0.5, 'sawtooth', 0.25, 60); break;
      case 'sputter': this.noise(0.25, 0.2, 250); this.tone(90, 0.3, 'sawtooth', 0.12, -50); break;
      case 'stop': this.tone(120, 0.5, 'sawtooth', 0.15, -80); break;
      case 'stall': this.tone(110, 0.8, 'sawtooth', 0.25, -90); this.noise(0.5, 0.2, 200, 'lowpass'); break;
      case 'brick': this.noise(0.07, 0.25, 1800); this.tone(220, 0.07, 'triangle', 0.12); break;
      case 'ladder': this.noise(0.06, 0.1, 900); this.tone(300, 0.05, 'triangle', 0.06); break;
      case 'pickup': this.noise(0.12, 0.12, 700); break;
      case 'thud': this.noise(0.25, 0.3, 200, 'lowpass'); this.tone(80, 0.25, 'sine', 0.3, -40); break;
      case 'perfect': [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.18, 0, i * 0.06)); this.noise(0.2, 0.15, 3000, 'highpass'); break;
      case 'good': this.tone(660, 0.12, 'triangle', 0.18); this.tone(880, 0.14, 'triangle', 0.18, 0, 0.07); break;
      case 'weak': this.tone(400, 0.15, 'triangle', 0.15); break;
      case 'fail': this.tone(200, 0.4, 'sawtooth', 0.22, -120); this.tone(150, 0.4, 'square', 0.12, -90, 0.1); break;
      case 'success': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, 0, i * 0.11)); break;
      case 'upgrade': this.tone(500, 0.1, 'square', 0.12); this.tone(750, 0.1, 'square', 0.12, 0, 0.08); this.tone(1000, 0.2, 'square', 0.12, 0, 0.16); break;
      case 'deny': this.tone(150, 0.2, 'square', 0.12); break;
      default: break;
    }
  }
}
