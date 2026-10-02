-- Preserve existing return-request data while aligning the physical table
-- with the already-applied ReturnRequest migration and Prisma model.
DO $$
BEGIN
    IF to_regclass('public."returnRequest"') IS NOT NULL
       AND to_regclass('public."ReturnRequest"') IS NULL THEN
        ALTER TABLE public."returnRequest" RENAME TO "ReturnRequest";
    END IF;

    IF to_regclass('public."ReturnRequest"') IS NULL THEN
        RAISE EXCEPTION 'Expected return-request table was not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'returnRequest_pkey'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'ReturnRequest_pkey'
    ) THEN
        ALTER TABLE public."ReturnRequest"
          RENAME CONSTRAINT "returnRequest_pkey" TO "ReturnRequest_pkey";
    END IF;

    IF to_regclass('public."returnRequest_orderId_idx"') IS NOT NULL
       AND to_regclass('public."ReturnRequest_orderId_idx"') IS NULL THEN
        ALTER INDEX public."returnRequest_orderId_idx"
          RENAME TO "ReturnRequest_orderId_idx";
    END IF;

    IF to_regclass('public."returnRequest_userId_idx"') IS NOT NULL
       AND to_regclass('public."ReturnRequest_userId_idx"') IS NULL THEN
        ALTER INDEX public."returnRequest_userId_idx"
          RENAME TO "ReturnRequest_userId_idx";
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'returnRequest_orderId_fkey'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'ReturnRequest_orderId_fkey'
    ) THEN
        ALTER TABLE public."ReturnRequest"
          RENAME CONSTRAINT "returnRequest_orderId_fkey"
          TO "ReturnRequest_orderId_fkey";
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'returnRequest_userId_fkey'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'ReturnRequest_userId_fkey'
    ) THEN
        ALTER TABLE public."ReturnRequest"
          RENAME CONSTRAINT "returnRequest_userId_fkey"
          TO "ReturnRequest_userId_fkey";
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'ReturnRequest_orderId_fkey'
    ) THEN
        ALTER TABLE public."ReturnRequest"
          ADD CONSTRAINT "ReturnRequest_orderId_fkey"
          FOREIGN KEY ("orderId") REFERENCES public."Order"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public."ReturnRequest"')
          AND conname = 'ReturnRequest_userId_fkey'
    ) THEN
        ALTER TABLE public."ReturnRequest"
          ADD CONSTRAINT "ReturnRequest_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES public."User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ReturnRequest_orderId_idx"
ON public."ReturnRequest"("orderId");

CREATE INDEX IF NOT EXISTS "ReturnRequest_userId_idx"
ON public."ReturnRequest"("userId");
