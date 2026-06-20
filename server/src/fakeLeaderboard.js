import { FAKE_NAMES } from './fakePlayers.js';

const AVATARS = [
  'plane-red',
  'plane-blue',
  'plane-green',
  'plane-gold',
  'plane-purple',
  'plane-neon',
];

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickNames(count) {
  const shuffled = [...FAKE_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function buildFakeLeaderboard(period) {
  const mult = period === 'daily' ? 0.4 : period === 'weekly' ? 0.65 : 1;
  const names = pickNames(14);

  const topWins = names.slice(0, 10).map((username) => ({
    username,
    avatar_id: AVATARS[rand(0, AVATARS.length - 1)],
    score: Math.floor(rand(800, 45000) * mult),
    isFake: true,
  }));

  const topMultipliers = pickNames(12).map((username) => ({
    username,
    avatar_id: AVATARS[rand(0, AVATARS.length - 1)],
    score: Math.round((rand(150, 480) / 100) * (period === 'all' ? 1.2 : 1) * 100) / 100,
    isFake: true,
  }));

  return { topWins, topMultipliers };
}

export function mergeLeaderboard(realWins, realMult, fakeWins, fakeMult) {
  const merge = (real, fake, sortFn) => {
    const combined = [...real.map((r) => ({ ...r, isFake: false })), ...fake];
    combined.sort(sortFn);
    return combined.slice(0, 20);
  };

  return {
    topWins: merge(realWins, fakeWins, (a, b) => b.score - a.score),
    topMultipliers: merge(realMult, fakeMult, (a, b) => b.score - a.score),
  };
}
