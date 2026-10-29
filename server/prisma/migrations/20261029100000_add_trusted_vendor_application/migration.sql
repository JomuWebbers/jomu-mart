ALTER TABLE "User"
ADD COLUMN "trustedVendorBusinessName" TEXT,
ADD COLUMN "trustedVendorCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "trustedVendorLocation" TEXT,
ADD COLUMN "trustedVendorDescription" TEXT,
ADD COLUMN "trustedVendorWebsite" TEXT,
ADD COLUMN "trustedVendorRequestedAt" TIMESTAMP(3),
ADD COLUMN "trustedVendorRejectionReason" TEXT;
