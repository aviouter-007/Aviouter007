import { v4 as uuid } from 'uuid';

export const FAKE_NAMES = [
  'PilotRavi', 'SkyKing92', 'JetFlyer', 'AceWing', 'TurboBird',
  'CloudRider', 'NightHawk', 'StarPilot', 'RedWing', 'BlueJet',
  'LuckyFly', 'ProAviator', 'MoonPlane', 'FastWing', 'GoldJet',
  'ShadowAce', 'FireBird', 'IcePilot', 'StormFly', 'NeoWing',
  'MaxFlyer', 'ZenPilot', 'BoltJet', 'CyberWing', 'EliteFly',
  'RocketX', 'AlphaJet', 'OmegaFly', 'DeltaWing', 'ViperAir',
];

const BET_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2500];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function pickFakeName(used) {
  const available = FAKE_NAMES.filter((n) => !used.has(n));
  const pool = available.length ? available : FAKE_NAMES;
  const name = pick(pool);
  used.add(name);
  return name;
}

export function createFakeBet(usedNames) {
  const autoCashout = Math.random() < 0.35 ? randomInt(15, 30) / 10 : null;
  return {
    id: `fake-${uuid()}`,
    userId: null,
    username: pickFakeName(usedNames),
    amount: pick(BET_AMOUNTS),
    autoCashout,
    cashoutMultiplier: null,
    status: 'active',
    isFake: true,
  };
}

export function getDisplayPlayerCount(realOnline, fakeBetCount) {
  return realOnline + fakeBetCount + randomInt(18, 64);
}
