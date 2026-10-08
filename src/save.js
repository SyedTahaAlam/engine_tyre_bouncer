import { UPGRADES, upgradeCost, MAX_UPGRADE } from './upgrades.js';
import { MAX_LEVELS } from './levels.js';

const KEY = 'engineTyreBouncer.save.v1';

export const defaultSave = () => ({
  coins: 0,
  currentLevel: 1,
  completed: {},
  stars: {},
  best: {},
  upgrades: {},
  custom: { engine: 0, wheel: 0, hat: 0 },
  settings: { sound: true, volume: 0.7, vibration: true, particles: 'high' },
});

export class Progress {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    this.storage = storage;
    this.data = this.load();
  }

  load() {
    const d = defaultSave();
    try {
      const raw = this.storage && this.storage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { ...d, ...p, custom: { ...d.custom, ...p.custom }, settings: { ...d.settings, ...p.settings } };
      }
    } catch (e) { /* corrupted save: start fresh */ }
    return d;
  }

  save() {
    try { this.storage && this.storage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  }

  reset() { this.data = defaultSave(); this.save(); }

  isUnlocked(n) { return n <= this.data.currentLevel; }

  completeLevel(n, result) {
    const d = this.data;
    d.coins += result.coins;
    d.completed[n] = true;
    d.stars[n] = Math.max(d.stars[n] || 0, result.stars);
    d.best[n] = Math.max(d.best[n] || 0, result.score);
    d.currentLevel = Math.max(d.currentLevel, Math.min(MAX_LEVELS, n + 1));
    this.save();
  }

  upgradeLevel(id) { return this.data.upgrades[id] || 0; }

  buy(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return { ok: false, reason: 'unknown' };
    const lv = this.upgradeLevel(id);
    if (lv >= MAX_UPGRADE) return { ok: false, reason: 'max' };
    const cost = upgradeCost(def, lv);
    if (this.data.coins < cost) return { ok: false, reason: 'coins' };
    this.data.coins -= cost;
    this.data.upgrades[id] = lv + 1;
    this.save();
    return { ok: true, cost };
  }
}
