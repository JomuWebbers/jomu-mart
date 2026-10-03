import { PrismaClient } from "@prisma/client";
import { withDbRetry, WARMUP_RETRY_DELAYS_MS } from "./dbRetry";

declare global {
  // eslint-disable-next-line no-var
  var __naijaMartPrisma: PrismaClient | undefined;
}

// One client for the whole process: a PrismaClient per controller file would
// open its own pool, and the combined pools exhaust Neon.
const client = globalThis.__naijaMartPrisma ?? new PrismaClient();

/**
 * Properties that must never be retried.
 *
 * $transaction is the important one. Its callback can already have applied
 * writes before a connection error surfaces, and Prisma gives no way to tell how
 * far it got, so replaying it risks applying a second time. Callers already make
 * their transactions idempotent (guarded stock decrement, single-claim fee
 * updates), so letting the error propagate is the safe choice.
 *
 * Underscore-prefixed internals ($transaction delegates to
 * _transactionWithCallback -> _tracingHelper.runInChildSpan) must be excluded
 * too. Wrapping those nested layers would retry a transaction at every level at
 * once, multiplying attempts and the wall-clock delay with each nesting depth.
 */
/**
 * Only read operations are retried.
 *
 * Rewriting a write to "succeed twice" is the risk to avoid, and the array form
 * `prisma.$transaction([prisma.order.update(...), ...])` requires its arguments
 * to be genuine Prisma promises. Wrapping a write in a plain async function
 * returns a native Promise instead, which Prisma rejects with "All elements of
 * the array need to be Prisma Client promises", so every batched write in the
 * app (seller payout, return refund) would 500.
 *
 * Reads are what a cold start actually breaks: the first GET after Neon resumes
 * has no connection, and a read is safe to repeat. A write that loses its
 * connection fails cleanly with no write applied, and the buyer retries.
 */
const RETRYABLE_READS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "exists",
]);

/**
 * Wraps read operations in a transient-error retry.
 *
 * Without this, the first request after Neon wakes from idle fails with a 500,
 * because only the boot warmup retried. Callers across the app use `prisma`
 * directly, so wrapping the shared client is the only place that covers them
 * all without editing nine controllers.
 */
function withRetry<T extends object>(target: T, label: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === "symbol") return Reflect.get(obj, prop, receiver);

      const value = Reflect.get(obj, prop, receiver);

      // Prisma internals ($transaction and its _ helpers) and writes pass through
      // untouched; only the named read operations below are safe to repeat.
      if (prop.startsWith("$") || prop.startsWith("_")) return value;
      if (!RETRYABLE_READS.has(prop)) return value;

      if (typeof value === "function") {
        // Bind to the real object so Prisma's internal `this` stays correct.
        const method = value.bind(obj);
        return (...args: unknown[]) =>
          withDbRetry(() => method(...args), `${label}.${prop}`);
      }

      if (value !== null && typeof value === "object") {
        return withRetry(value, `${label}.${String(prop)}`);
      }

      return value;
    },
  });
}

export const prisma = withRetry(client, "prisma");

if (process.env.NODE_ENV !== "production") {
  globalThis.__naijaMartPrisma = client;
}

/** Warms the pool so the first real request does not pay the cold-start cost. */
export async function warmDatabaseConnection(): Promise<void> {
  const started = Date.now();
  try {
    await withDbRetry(
      () => client.$queryRaw`SELECT 1`,
      "database warmup",
      WARMUP_RETRY_DELAYS_MS,
    );
    console.log(`database warmup succeeded after ${Date.now() - started}ms`);
  } catch (error) {
    // Never block startup: the model operations above retry on their own.
    console.error(
      `Database warmup failed after ${Date.now() - started}ms:`,
      (error as Error)?.message ?? error,
    );
  }
}

export default prisma;


