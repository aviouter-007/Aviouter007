import crypto from 'crypto';

export function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

/** Provably fair crash point (1.00x minimum, capped by maxMultiplier). */
export function computeCrashPoint(serverSeed, clientSeed, houseEdge = 0.03, maxMultiplier = 100) {
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(clientSeed)
    .digest('hex');

  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);

  if (h % 33 === 0) {
    return 1.0;
  }

  let result = Math.floor((100 * e - h) / (e - h)) / 100;
  result = Math.max(1, result * (1 - houseEdge));
  return Math.min(Math.round(result * 100) / 100, maxMultiplier);
}

export function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}

export function generateClientSeed() {
  return crypto.randomBytes(16).toString('hex');
}

/** Biased crash for house-controlled rounds (min–max multiplier). */
export function computeBiasedCrashPoint(min, max) {
  const lo = Math.max(1.01, min);
  const hi = Math.max(lo, max);
  const r = Math.pow(Math.random(), 1.4);
  return Math.round((lo + r * (hi - lo)) * 100) / 100;
}
