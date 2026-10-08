export const WALL_WIDTH = 88;
export const REACH_ROWS = 3;
export const MAX_LEVELS = 20;

const CHALLENGES = {
  1: 'Learn the timing meter. Release in the GREEN zone!',
  2: 'Faster meter, smaller green zone. The worker must climb the ladder.',
  3: 'Fuel, temperature and combo chains: land consecutive good releases.',
  4: 'Engine can overheat! The ladder must be moved between wall stages.',
  5: 'Air filter gets dirty. Clean it to keep your power up.',
  6: 'Time limit and a surging meter.',
  7: 'The drive belt slips. Tighten it regularly.',
  8: 'The green zone drifts after every release.',
  9: 'Wind and dust gusts disturb the meter.',
};

export function getLevel(n) {
  const L = Math.max(1, Math.floor(n));
  const cols = Math.min(8, 3 + Math.ceil(L / 2));
  const rows = L === 1 ? 3 : Math.min(14, 2 + L);
  const bricks = cols * rows;
  const greenHalf = Math.max(0.07, 0.17 - 0.008 * (L - 1));
  const yellowHalf = greenHalf + Math.max(0.1, 0.16 - 0.005 * (L - 1));
  const stages = L >= 4 ? Math.min(4, Math.ceil(rows / 4)) : 1;
  const stageRows = Math.ceil(rows / stages);
  return {
    number: L,
    name: `Job ${L}`,
    challenge: CHALLENGES[L] || 'Master class: tighter tolerances and heavier workload.',
    cols,
    rows,
    bricks,
    bw: WALL_WIDTH / cols,
    bh: (WALL_WIDTH / cols) * 0.8,
    stages,
    stageRows,
    stageBricks: stageRows * cols,
    meter: {
      speed: Math.min(0.8, 0.3 + 0.04 * (L - 1)),
      greenHalf,
      yellowHalf,
      pattern: L >= 6 ? 'surge' : L >= 3 ? 'sine' : 'pingpong',
      variation: Math.min(0.5, (L >= 4 ? 0.08 * (L - 3) : 0) + (L >= 9 ? 0.1 : 0)),
      drift: L >= 8,
    },
    powerReq: Math.min(1, 0.45 + 0.04 * L),
    fuelEnabled: L >= 3,
    fuelRate: 0.5 + 0.07 * Math.max(0, L - 3),
    heatEnabled: L >= 3,
    heat: Math.min(1.6, 0.6 + 0.11 * Math.max(0, L - 3)),
    overheat: L >= 4,
    ladder: rows > REACH_ROWS,
    filter: L >= 5,
    belt: L >= 7,
    wind: L >= 9,
    chain: L >= 3 ? Math.min(4, 2 + Math.floor((L - 3) / 4)) : 0,
    timeLimit: L >= 6 ? Math.round(45 + bricks * 1.5) : 0,
    parTime: Math.round(25 + bricks * 1.0),
    reward: 40 + 25 * L,
  };
}
