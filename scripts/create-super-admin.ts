import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Equipo VanillaSoft";

  if (!email || !password || password.length < 12) {
    throw new Error("Define SUPER_ADMIN_EMAIL y SUPER_ADMIN_PASSWORD (mínimo 12 caracteres).");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { platformAdmin: true, _count: { select: { memberships: true } } },
  });
  if (existing && (!existing.platformAdmin || existing._count.memberships > 0)) {
    throw new Error("Ese correo ya pertenece a un usuario de una organización.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, platformAdmin: true, failedLoginAttempts: 0, lockedUntil: null },
    create: { email, passwordHash, name, platformAdmin: true },
  });
  console.log(`SUPER_ADMIN listo: ${email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
