/**
 * Assigns the first-login temporary password to existing accounts.
 * Run once after the password migration:
 *   npm run passwords:initialize
 */
import "dotenv/config";
import { prisma } from "../src/config/db";
import { createTemporaryPassword, hashPassword } from "../src/utils/password";

async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const passwordHash = await hashPassword(createTemporaryPassword(user.name, user.mobileNumber));
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
    });
  }
  console.log(`Initialized temporary passwords for ${users.length} account(s).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
