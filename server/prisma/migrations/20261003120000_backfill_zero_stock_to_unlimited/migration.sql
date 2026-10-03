-- Data migration: stock semantics are now enforced on order placement.
--   stock IS NULL -> unlimited (nothing is decremented)
--   stock = 0      -> sold out (orders are rejected)
--
-- Historically stock was never checked at order time, so listings created with
-- a blank quantity ended up with stock = 0 and stayed freely buyable.
-- Converting those to NULL preserves the current behaviour of every existing
-- listing exactly, while new listings must declare a real quantity.
UPDATE "Product"
SET "stock" = NULL
WHERE "stock" = 0;