CREATE TABLE "ai_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text,
	"barcode" text,
	"price_minor" integer NOT NULL,
	"confidence" real NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "current_prices" (
	"store_id" text NOT NULL,
	"barcode" text NOT NULL,
	"price_minor" integer NOT NULL,
	"source" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"confidence" real NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"barcode" text NOT NULL,
	"name" text,
	"brand" text,
	"size" text,
	"price_minor" integer NOT NULL,
	"source" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"confidence" real NOT NULL,
	"promo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_observations_price_minor_positive" CHECK ("price_observations"."price_minor" > 0),
	CONSTRAINT "price_observations_confidence_range" CHECK ("price_observations"."confidence" >= 0 AND "price_observations"."confidence" <= 1)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"barcode" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"size" text
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"geom" geometry(point),
	"tag_template" text
);
--> statement-breakpoint
CREATE TABLE "tag_crops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_observation_id" uuid,
	"crop_r2_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_results" ADD CONSTRAINT "ai_results_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_prices" ADD CONSTRAINT "current_prices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_prices" ADD CONSTRAINT "current_prices_barcode_products_barcode_fk" FOREIGN KEY ("barcode") REFERENCES "public"."products"("barcode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_barcode_products_barcode_fk" FOREIGN KEY ("barcode") REFERENCES "public"."products"("barcode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_crops" ADD CONSTRAINT "tag_crops_price_observation_id_price_observations_id_fk" FOREIGN KEY ("price_observation_id") REFERENCES "public"."price_observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "current_prices_store_barcode_idx" ON "current_prices" USING btree ("store_id","barcode");--> statement-breakpoint
CREATE INDEX "price_observations_store_barcode_time_idx" ON "price_observations" USING btree ("store_id","barcode","observed_at");