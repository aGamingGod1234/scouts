const argon2 = require("argon2");
const { PrismaClient, Role } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_EMAIL = "lucastoh41@gmail.com";
const DEFAULT_PASSWORD = "Hwachong@2024";
const DEFAULT_ROLE = "DEV";

function getEnvValue(key, fallback) {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

async function main() {
  const email = getEnvValue("INIT_ADMIN_EMAIL", DEFAULT_EMAIL).toLowerCase();
  const password = getEnvValue("INIT_ADMIN_PASSWORD", DEFAULT_PASSWORD);
  const roleInput = getEnvValue("INIT_ADMIN_ROLE", DEFAULT_ROLE).toUpperCase();
  const roleValues = new Set(Object.values(Role));
  const fallbackRole = roleValues.has("DEV")
    ? "DEV"
    : roleValues.has("ADMIN")
      ? "ADMIN"
      : Array.from(roleValues)[0];
  const role = roleValues.has(roleInput) ? roleInput : fallbackRole;

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role,
      passwordHash,
      isActive: true
    },
    create: {
      email,
      name: "Dev User",
      role,
      passwordHash,
      isActive: true
    }
  });

  console.log(`Seeded user: ${user.email} (${user.role})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
