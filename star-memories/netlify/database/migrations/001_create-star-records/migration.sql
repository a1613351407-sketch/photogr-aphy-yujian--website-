CREATE TABLE "memories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slot" integer NOT NULL,
	"occurred_at" text NOT NULL,
	"content" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE UNIQUE INDEX "memories_user_slot" ON "memories" ("user_id","slot");
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"memory_id" text NOT NULL,
	"user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"position" integer NOT NULL,
	FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON UPDATE no action ON DELETE no action
);

CREATE INDEX "photos_memory" ON "photos" ("memory_id");
CREATE INDEX "photos_user" ON "photos" ("user_id");
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"username_key" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE UNIQUE INDEX "accounts_username_key_unique" ON "accounts" ("username_key");
CREATE TABLE "auth_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" text NOT NULL
);

CREATE TABLE "account_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON UPDATE no action ON DELETE no action
);

CREATE INDEX "account_sessions_account" ON "account_sessions" ("account_id");
