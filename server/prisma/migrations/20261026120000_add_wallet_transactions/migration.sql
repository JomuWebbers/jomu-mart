CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletTransaction_reference_key"
ON "WalletTransaction"("reference");

CREATE INDEX "WalletTransaction_userId_createdAt_idx"
ON "WalletTransaction"("userId", "createdAt");

CREATE INDEX "WalletTransaction_userId_direction_createdAt_idx"
ON "WalletTransaction"("userId", "direction", "createdAt");

CREATE INDEX "WalletTransaction_type_status_createdAt_idx"
ON "WalletTransaction"("type", "status", "createdAt");

ALTER TABLE "WalletTransaction"
ADD CONSTRAINT "WalletTransaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WalletTransaction" (
    "id", "userId", "type", "direction", "amount", "status",
    "description", "reference", "metadata", "createdAt", "updatedAt"
)
SELECT
    'opening-balance-' || "id",
    "id",
    'opening_balance',
    'received',
    "accountBalance",
    'completed',
    'Opening wallet balance carried forward; original credit details were not recorded',
    'opening-balance-' || "id",
    '{"source":"legacy_balance_backfill"}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "accountBalance" > 0;
