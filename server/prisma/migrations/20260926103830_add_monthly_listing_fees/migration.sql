-- CreateTable
CREATE TABLE "SellerListingFee" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "firstProductId" TEXT NOT NULL,
    "reference" TEXT,
    "authorizationUrl" TEXT,
    "amountKobo" INTEGER NOT NULL DEFAULT 100000,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerListingFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerListingFee_reference_key" ON "SellerListingFee"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SellerListingFee_sellerId_monthKey_key" ON "SellerListingFee"("sellerId", "monthKey");

-- AddForeignKey
ALTER TABLE "SellerListingFee" ADD CONSTRAINT "SellerListingFee_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
