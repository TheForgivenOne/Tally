// Price resolution + confidence logic for Tally.
// Single source of truth: web, api, and the future mobile app import this.
// Prices are integer minor units (e.g. JMD cents) — never floats.
// Every price carries { source, age, confidence }; lower sources never
// overwrite higher ones. Bands are starting values, tuned with receipts.

/** Where a price came from, in resolution order (stop at first hit). */
export type PriceSource = 'cache' | 'tag' | 'barcode-cache' | 'web' | 'ai';

/** One observed price for a store + product. */
export interface PriceObservation {
  /** Integer minor units (e.g. 15000 = J$150.00). */
  priceMinor: number;
  source: PriceSource;
  /** ISO-8601 timestamp of the observation. Determines age. */
  observedAt: string;
  /** 0–1. Stored with every price; informational alongside source + age. */
  confidence: number;
}

/** Lower rank = higher authority. Equal ranks tie-break by newest. */
const SOURCE_RANK: Record<PriceSource, number> = {
  tag: 0,
  cache: 1,
  'barcode-cache': 1,
  web: 2,
  ai: 3,
};

/** A tag/cache observation at most this old counts as "recent". Tunable. */
export const RECENT_DAYS = 7;

const DAY_MS = 86_400_000;

function ageDays(observation: PriceObservation, now: number): number {
  return Math.max(0, (now - Date.parse(observation.observedAt)) / DAY_MS);
}

/**
 * Pick the winning observation: best (lowest) source rank, newest on ties.
 * Returns undefined when there is nothing to resolve from.
 */
export function resolvePrice(observations: PriceObservation[]): PriceObservation | undefined {
  let best: PriceObservation | undefined;
  for (const current of observations) {
    if (best === undefined) {
      best = current;
      continue;
    }
    const rankDelta = SOURCE_RANK[current.source] - SOURCE_RANK[best.source];
    if (rankDelta < 0 || (rankDelta === 0 && current.observedAt > best.observedAt)) {
      best = current;
    }
  }
  return best;
}

/**
 * Whether `incoming` may replace `existing` as the current price.
 * Higher-authority sources always win; equal ranks go to the newest.
 */
export function canOverwrite(existing: PriceObservation, incoming: PriceObservation): boolean {
  const rankDelta = SOURCE_RANK[incoming.source] - SOURCE_RANK[existing.source];
  if (rankDelta !== 0) return rankDelta < 0;
  return incoming.observedAt >= existing.observedAt;
}

/** Fractional error band for one observation (0.02 = ±2%). */
export function errorBand(observation: PriceObservation, now: number): number {
  switch (observation.source) {
    case 'tag':
      return ageDays(observation, now) <= RECENT_DAYS ? 0.02 : 0.05;
    case 'cache':
    case 'barcode-cache':
      return ageDays(observation, now) <= RECENT_DAYS ? 0.05 : 0.1;
    case 'web':
      return 0.1;
    case 'ai':
      return 0.25;
  }
}

export interface BasketLine {
  observation: PriceObservation;
  quantity: number;
}

export interface BasketRange {
  minMinor: number;
  maxMinor: number;
  disclaimer: string;
}

export const REGISTER_DISCLAIMER = 'Predicted total — register total may differ.';

/** UI label for a price source: ground truth reads are exact, the rest estimated. */
export type PriceLabel = 'exact' | 'estimated';

export function labelFor(source: PriceSource): PriceLabel {
  switch (source) {
    case 'tag':
    case 'cache':
    case 'barcode-cache':
      return 'exact';
    case 'web':
    case 'ai':
      return 'estimated';
  }
}

/**
 * Predicted basket total as a range: each line contributes
 * price × qty ± its error band. Integer minor units, rounded.
 */
export function priceRange(lines: BasketLine[], now: number): BasketRange {
  let minMinor = 0;
  let maxMinor = 0;
  for (const line of lines) {
    const band = errorBand(line.observation, now);
    const lineTotal = line.observation.priceMinor * line.quantity;
    minMinor += Math.round(lineTotal * (1 - band));
    maxMinor += Math.round(lineTotal * (1 + band));
  }
  return { minMinor, maxMinor, disclaimer: REGISTER_DISCLAIMER };
}
