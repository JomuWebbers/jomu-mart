import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __naijaMartPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__naijaMartPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__naijaMartPrisma = prisma;
}

export default prisma;

