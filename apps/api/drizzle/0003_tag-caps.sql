CREATE TABLE "tag_read_caps" (
	"key" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tag_read_caps_key_day_idx" ON "tag_read_caps" USING btree ("key","day");