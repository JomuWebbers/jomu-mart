import { Prisma } from "@prisma/client";

/**
 * Neon cold starts can leave the pooled connection briefly unavailable, which
 * surfaces as a 500 on the first request after an idle period. These codes mean
 * "try again shortly"; anything else (a unique violation, a failed constraint)
 * is a real error and must not be retried.
 */
const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P2024", "P2028"]);

export function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_CODES.has(error.code);
  }
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && TRANSIENT_CODES.has(code);
}

// Resuming a sleeping Neon project takes on the order of 10 seconds, so the
// backoff has to span that window. A millisecond-scale schedule gives up while
// the database is still waking, which is exactly what the first boot hit.
const REQUEST_RETRY_DELAYS_MS = [500, 1500, 3000, 6000];
// The boot warmup blocks nobody, so it can afford a far longer budget.
export const WARMUP_RETRY_DELAYS_MS = [1000, 3000, 6000, 10000, 15000];

/**
 * Runs `operation`, retrying only transient connection failures. A request that
 * arrives mid-cold-start rides the wake-up out instead of failing outright.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  label = "db operation",
  retryDelaysMs: number[] = REQUEST_RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDbError(error)) throw error;
      lastError = error;

      if (attempt === retryDelaysMs.length) break;

      console.warn(
        `${label} hit a transient database error ` +
          `(attempt ${attempt + 1}/${retryDelaysMs.length + 1}), ` +
          `retrying in ${retryDelaysMs[attempt]}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
    }
  }

  throw lastError;
}



