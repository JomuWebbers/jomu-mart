-- AlterTable
ALTER TABLE "SellerListingFee" ADD COLUMN     "paymentMethod" TEXT DEFAULT 'paystack';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "freeListingsUsed" INTEGER NOT NULL DEFAULT 0;

-- Backfill: grandfather existing sellers with the listings they have already created
-- so nobody loses free quota they had earned before this migration.
UPDATE "User" u
SET "freeListingsUsed" = COALESCE(p.product_count, 0)
FROM (
  SELECT "sellerId", COUNT(*)::int AS product_count
  FROM "Product"
  GROUP BY "sellerId"
) p
WHERE u."id" = p."sellerId";
