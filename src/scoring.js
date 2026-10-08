export function newStats() {
  return { perfect: 0, good: 0, weak: 0, fail: 0, releases: 0, elapsed: 0 };
}

export function accuracy(st) {
  return st.releases ? (st.perfect + 0.6 * st.good + 0.2 * st.weak) / st.releases : 0;
}

export function computeResult(level, st, engine) {
  const acc = accuracy(st);
  const fuelFrac = level.fuelEnabled ? engine.fuel / engine.stats.fuelCap : 1;
  const health = engine.health;
  const onTime = st.elapsed <= level.parTime;
  let stars = 1;
  if (acc >= 0.35 && health >= 25) stars = 2;
  if (acc >= 0.6 && health >= 50 && onTime && st.fail <= 2) stars = 3;
  const speedBonus = Math.max(0, Math.round((level.parTime - st.elapsed) * 5));
  const score = Math.max(0, Math.round(st.perfect * 100 + st.good * 60 + st.weak * 20 - st.fail * 80 + health * 3 + (level.fuelEnabled ? fuelFrac * 100 : 0) + speedBonus));
  const coins = Math.round(level.reward * (0.6 + 0.2 * stars) + st.perfect * 3);
  return { stars, score, coins, accuracy: acc, health: Math.round(health), fuelFrac, time: st.elapsed, ...st };
}

export const RATING = { 3: 'Excellent performance', 2: 'Good performance', 1: 'Completed, but inefficient' };
