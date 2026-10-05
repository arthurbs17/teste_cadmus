CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "consent_status" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'BOOKED');

CREATE TYPE "sync_run_status" AS ENUM ('RUNNING', 'SUCCEEDED', 'RATE_LIMITED', 'FAILED');

CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "institution_id" TEXT NOT NULL,
    "external_consent_id" TEXT NOT NULL,
    "status" "consent_status" NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_synced_at" TIMESTAMPTZ(3),
    "sync_lease_owner" TEXT,
    "sync_lease_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "consent_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "institution_id" TEXT NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "external_transaction_id" TEXT NOT NULL,
    "booked_at" TIMESTAMPTZ(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "transaction_status" NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "consent_id" UUID NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "status" "sync_run_status" NOT NULL,
    "checkpoint" JSONB,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "pages_fetched" INTEGER NOT NULL DEFAULT 0,
    "transactions_upserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consents_customer_id_idx" ON "consents"("customer_id");

CREATE UNIQUE INDEX "consents_institution_id_external_consent_id_key" ON "consents"("institution_id", "external_consent_id");

CREATE INDEX "accounts_consent_id_idx" ON "accounts"("consent_id");

CREATE UNIQUE INDEX "accounts_institution_id_external_account_id_key" ON "accounts"("institution_id", "external_account_id");

CREATE INDEX "transactions_account_id_booked_at_id_idx" ON "transactions"("account_id", "booked_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "transactions_account_id_external_transaction_id_key" ON "transactions"("account_id", "external_transaction_id");

CREATE INDEX "sync_runs_consent_id_started_at_idx" ON "sync_runs"("consent_id", "started_at" DESC);

CREATE INDEX "sync_runs_status_started_at_idx" ON "sync_runs"("status", "started_at");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
