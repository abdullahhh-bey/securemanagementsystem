import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../db/db.js";

function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value;
}

async function main() {
  const missing = ["SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD", "SEED_ADMIN_NAME"].filter(
    (name) => !requireEnv(name),
  );

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}.\n` +
        "Add them to backend/.env before running the seed.",
    );
    process.exit(1);
  }

  const email = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME.trim();

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      fullName,
      role: "ADMIN",
      isActive: true,
    },
    update: {
      passwordHash,
      fullName,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Admin user ready: ${user.email} (${user.role})`);
}

main()
  .catch((error) => {
    console.error("Admin seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
