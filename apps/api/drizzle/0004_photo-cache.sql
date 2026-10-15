ALTER TABLE "ai_results" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "ai_results" ADD COLUMN "image_hash" text;--> statement-breakpoint
CREATE INDEX "ai_results_image_hash_idx" ON "ai_results" USING btree ("image_hash");