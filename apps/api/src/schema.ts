import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  geometry,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tally shared price database (Neon Postgres + PostGIS).
 *
 * PRIVACY HARD RULES (Jamaica DPA — lawyer review before launch):
 * - No user/device IDs anywhere in this schema. No location trail.
 * - price_observations is append-only contributed data: product + price +
 *   source + confidence + store + date only.
 * - Receipt images are discarded after extraction (never stored).
 * - Shelf photos are never stored whole — tag_crops holds R2 keys of
 *   cropped tag images linked to confirmed prices only.
 * - Trips/basket history/budgets are private + local-first (Dexie on device),
 *   never joined to these tables.
 */

export const stores = pgTable('stores', {
  /** Stable store ID (e.g. "store-demo-1"). Client saves this, never coords. */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Store point (static, per-store — not a user trail). Null until surveyed. */
  geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }),
  /** Per-store shelf-tag template hint for the OCR reader. */
  tagTemplate: text('tag_template'),
});

export const products = pgTable('products', {
  /** Global barcode (EAN/UPC). Identifies the product; never a price by itself. */
  barcode: text('barcode').primaryKey(),
  name: text('name').notNull(),
  brand: text('brand'),
  size: text('size'),
});

/** Append-only contributed price reports. Never UPDATE or DELETE rows here. */
export const priceObservations = pgTable(
  'price_observations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    barcode: text('barcode')
      .notNull()
      .references(() => products.barcode),
    name: text('name'),
    brand: text('brand'),
    size: text('size'),
    /** Integer minor units (e.g. 15000 = J$150.00). Never floats. */
    priceMinor: integer('price_minor').notNull(),
    source: text('source').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    confidence: real('confidence').notNull(),
    promo: boolean('promo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('price_observations_store_barcode_time_idx').on(t.storeId, t.barcode, t.observedAt),
    check('price_observations_price_minor_positive', sql`${t.priceMinor} > 0`),
    check('price_observations_confidence_range', sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`),
  ],
);

/** Derived current price per store + product. Rebuilt from price_observations. */
export const currentPrices = pgTable(
  'current_prices',
  {
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    barcode: text('barcode')
      .notNull()
      .references(() => products.barcode),
    priceMinor: integer('price_minor').notNull(),
    source: text('source').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    confidence: real('confidence').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex('current_prices_store_barcode_idx').on(t.storeId, t.barcode),
  ],
);

/** AI vision results, stored with confidence for audit + shrinking AI use. */
export const aiResults = pgTable('ai_results', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: text('store_id').references(() => stores.id),
  barcode: text('barcode'),
  priceMinor: integer('price_minor').notNull(),
  confidence: real('confidence').notNull(),
  model: text('model').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * Cropped tag images only (R2 keys). Never whole shelf photos.
 * Linked to confirmed prices as training data for the in-house reader.
 */
export const tagCrops = pgTable('tag_crops', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  priceObservationId: uuid('price_observation_id').references(() => priceObservations.id),
  cropR2Key: text('crop_r2_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * Durable per-day tag-read counters. `key` already encodes the identity
 * scheme (`device:<id>:<day>` or `ip:<ip>:<day>` — see index.ts), so this
 * table holds no identities of its own, only opaque counters.
 */
export const tagReadCaps = pgTable(
  'tag_read_caps',
  {
    key: text('key').notNull(),
    day: text('day').notNull(),
    count: integer('count').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex('tag_read_caps_key_day_idx').on(t.key, t.day)],
);
