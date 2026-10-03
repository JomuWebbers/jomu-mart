import { Prisma } from "@prisma/client";
import prisma from "./prisma";


const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P2024", "P2028"]);

export function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_CODES.has(error.code);
  }
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && TRANSIENT_CODES.has(code);
}

const RETRY_DELAYS_MS = [250, 500, 1000];


export async function withDbRetry<T>(
  operation: () => Promise<T>,
  label = "db operation",
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDbError(error)) throw error;
      lastError = error;

      if (attempt === RETRY_DELAYS_MS.length) break;

      console.warn(
        `${label} hit a transient database error (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}), retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }

  throw lastError;
}

/** Warms the pool so the first real request does not pay the cold-start cost. */
export async function warmDatabaseConnection(): Promise<void> {
  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, "database warmup");
  } catch (error) {
    // Never block startup: the first real request will retry on its own.
    console.error("Database warmup failed:", (error as Error)?.message ?? error);
  }
}