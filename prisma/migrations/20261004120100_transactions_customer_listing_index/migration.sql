CREATE INDEX CONCURRENTLY IF NOT EXISTS "transactions_customer_id_booked_at_id_idx" ON "transactions"("customer_id", "booked_at" DESC, "id" DESC);
