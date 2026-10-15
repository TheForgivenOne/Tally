DROP INDEX "current_prices_store_barcode_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "current_prices_store_barcode_idx" ON "current_prices" USING btree ("store_id","barcode");