import { clamp } from './util.js';

export const IDLE = 0.18;
export const RPM_MAX = 4000;

export class Engine {
  constructor(stats, rng = Math.random) {
    this.stats = stats;
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.running = false;
    this.fuelOn = false;
    this.throttle = 0.4;
    this.rpm = 0;
    this.temp = 0.2;
    this.fuel = this.stats.fuelCap;
    this.health = 100;
    this.filterDirt = 0;
    this.beltTension = 1;
    this.vibration = 0;
    this.smoke = 0;
    this.wheelAngle = 0;
    this.crankAngle = 0;
    this.overheating = false;
    this.stallEvent = null;
  }

  get rpmValue() { return Math.round(this.rpm * RPM_MAX); }

  beltSlip(lvl) {
    return lvl && lvl.belt ? clamp(((1 - this.beltTension) * 0.5) / this.stats.slipResist, 0, 0.5) : 0;
  }

  outputPower(lvl) {
    if (!this.running) return 0;
    const healthF = 0.6 + 0.4 * (this.health / 100);
    const heatF = this.overheating ? 0.75 : 1;
    return this.rpm * this.stats.power * this.stats.transfer * healthF * heatF * (1 - 0.3 * this.filterDirt) * (1 - this.beltSlip(lvl));
  }

  setThrottle(v) { this.throttle = clamp(v, 0, 1); }

  ignite() {
    this.running = true;
    this.rpm = Math.max(this.rpm, IDLE * 0.8);
    this.stallEvent = null;
  }

  stop() { this.running = false; }

  stall(reason) {
    if (!this.running) return;
    this.running = false;
    this.stallEvent = reason;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount / this.stats.durability);
  }

  applyLoad(amount) {
    this.rpm = Math.max(0, this.rpm - amount * this.stats.loadDip);
  }

  update(dt, lvl) {
    const s = this.stats;
    if (this.running) {
      if (!this.fuelOn) this.stall('NO FUEL VALVE');
      else if (lvl.fuelEnabled && this.fuel <= 0) this.stall('OUT OF FUEL');
    }
    if (this.running) {
      let target = (IDLE + (1 - IDLE) * this.throttle) * (1 - 0.25 * this.filterDirt);
      target += (this.rng() - 0.5) * s.rpmNoise;
      this.rpm += (target - this.rpm) * Math.min(1, 1.2 * s.rpmResponse * dt);
      this.rpm = clamp(this.rpm, 0, 1.05);
      if (lvl.fuelEnabled) this.fuel = Math.max(0, this.fuel - ((0.25 + 1.1 * this.rpm * this.rpm) * lvl.fuelRate / s.fuelEff) * dt);
      const heat = lvl.heatEnabled ? lvl.heat * (1 + this.filterDirt * 0.4) : 0.35;
      const tTarget = Math.min(1.1, 0.2 + (0.8 * this.rpm * this.rpm * heat) / s.cooling);
      this.temp += (tTarget - this.temp) * 0.25 * dt;
      this.overheating = !!lvl.overheat && this.temp > 0.85;
      if (this.overheating) this.damage((this.temp - 0.85) * 40 * dt);
      if (lvl.overheat && this.temp >= 1) this.stall('OVERHEATED');
      if (lvl.filter) this.filterDirt = Math.min(1, this.filterDirt + 0.01 * this.rpm * dt);
      if (lvl.belt) this.beltTension = Math.max(0, this.beltTension - 0.011 * this.rpm * dt);
    } else {
      this.rpm = Math.max(0, this.rpm - 0.8 * dt);
      this.temp += (0.2 - this.temp) * 0.1 * dt;
      this.overheating = false;
    }
    if (this.health <= 0) {
      this.health = 0;
      if (this.running) this.stall('ENGINE WRECKED');
      else if (!this.stallEvent) this.stallEvent = 'ENGINE WRECKED';
    }
    const slip = this.beltSlip(lvl);
    const vib = (this.running ? 0.15 * this.rpm : 0) + Math.max(0, this.rpm - 0.9) * 3 + (this.overheating ? 0.5 : 0) + this.filterDirt * 0.3 + (this.health < 35 && this.running ? 0.4 : 0) + slip;
    this.vibration += (clamp(vib, 0, 1.5) - this.vibration) * Math.min(1, 6 * dt);
    const smk = this.running ? 0.2 + this.rpm * 0.5 + this.filterDirt * 0.3 + (this.overheating ? 0.5 : 0) + (this.health < 50 ? 0.3 : 0) : 0;
    this.smoke += (smk * s.smokeMul - this.smoke) * Math.min(1, 4 * dt);
    this.crankAngle += this.rpm * 40 * dt;
    this.wheelAngle += this.rpm * 9 * s.wheelSpeed * s.transfer * (1 - slip) * dt;
  }
}
