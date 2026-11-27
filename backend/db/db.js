
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_URL ?? process.env.DIRECT_URL
    : process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 10_000,
    timeout: 20_000,
  },
});

export default prisma;
