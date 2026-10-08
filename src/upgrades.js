export const MAX_UPGRADE = 5;

export const UPGRADES = [
  { id: 'power', icon: '⚙️', name: 'Engine Power', base: 60, desc: 'Higher max power output.', fx: (l) => `+${l * 12}% power` },
  { id: 'rpm', icon: '🎚️', name: 'RPM Control', base: 50, desc: 'Precise throttle, steadier RPM, wider green zone.', fx: (l) => `+${l * 5}% green zone` },
  { id: 'tank', icon: '⛽', name: 'Fuel Tank', base: 40, desc: 'More fuel capacity.', fx: (l) => `${100 + l * 25} fuel` },
  { id: 'efficiency', icon: '🍃', name: 'Fuel Efficiency', base: 55, desc: 'Burns less fuel.', fx: (l) => `-${Math.round((1 - 1 / (1 + l * 0.15)) * 100)}% fuel use` },
  { id: 'cooling', icon: '❄️', name: 'Cooling System', base: 55, desc: 'Runs cooler under load.', fx: (l) => `+${l * 18}% cooling` },
  { id: 'durability', icon: '🛡️', name: 'Engine Durability', base: 65, desc: 'Less damage from failed operations.', fx: (l) => `-${Math.round((1 - 1 / (1 + l * 0.2)) * 100)}% damage` },
  { id: 'drive', icon: '🔗', name: 'Belt / Drive', base: 50, desc: 'Better power transfer, less belt slip.', fx: (l) => `${Math.round(Math.min(1, 0.88 + 0.025 * l) * 100)}% transfer` },
  { id: 'flywheel', icon: '🛞', name: 'Flywheel', base: 45, desc: 'RPM holds steady after each release.', fx: (l) => `-${Math.round((1 - 1 / (1 + l * 0.5)) * 100)}% RPM dip` },
  { id: 'starter', icon: '🔑', name: 'Starter', base: 35, desc: 'Easier engine starting.', fx: (l) => `+${l * 15}% start window` },
  { id: 'exhaust', icon: '💨', name: 'Exhaust System', base: 40, desc: 'Less smoke.', fx: (l) => `-${Math.round((1 - 1 / (1 + l * 0.25)) * 100)}% smoke` },
  { id: 'machine', icon: '🏗️', name: 'Machine Speed', base: 70, desc: 'More bricks per operation, faster wheel.', fx: (l) => `+${l * 6}% work` },
  { id: 'ladder', icon: '🪜', name: 'Ladder Equipment', base: 45, desc: 'Worker climbs and moves faster.', fx: (l) => `+${l * 15}% worker speed` },
];

export const upgradeCost = (def, level) => Math.round(def.base * Math.pow(1.6, level));

export function computeStats(lv = {}) {
  const g = (id) => lv[id] || 0;
  return {
    power: 1 + 0.12 * g('power'),
    rpmResponse: 1.5 + 0.6 * g('rpm'),
    rpmNoise: 0.03 / (1 + g('rpm')),
    greenBonus: 1 + 0.05 * g('rpm'),
    fuelCap: 100 + 25 * g('tank'),
    fuelEff: 1 + 0.15 * g('efficiency'),
    cooling: 1 + 0.18 * g('cooling'),
    durability: 1 + 0.2 * g('durability'),
    transfer: Math.min(1, 0.88 + 0.025 * g('drive')),
    slipResist: 1 + 0.12 * g('drive'),
    loadDip: 1 / (1 + 0.5 * g('flywheel')),
    starterBonus: 1 + 0.15 * g('starter'),
    starterSpeed: 1 - 0.06 * g('starter'),
    smokeMul: 1 / (1 + 0.25 * g('exhaust')),
    work: 1 + 0.06 * g('machine'),
    wheelSpeed: 1 + 0.08 * g('machine'),
    ladderSpeed: 1 + 0.15 * g('ladder'),
  };
}
