/**
 * Creates the first admin account so someone can log in and use the Admin screen
 * in the app to add teachers/students from then on.
 *
 * Usage:
 *   npx ts-node scripts/seed-admin.ts "Your Name" 9876543210
 */
import "dotenv/config";
import { prisma } from "../src/config/db";
import { normalizeMobileNumber } from "../src/utils/phone";
import { createTemporaryPassword, hashPassword } from "../src/utils/password";

async function main() {
  const [name, rawMobile] = process.argv.slice(2);
  if (!name || !rawMobile) {
    console.error('Usage: npx ts-node scripts/seed-admin.ts "Your Name" 9876543210');
    process.exit(1);
  }

  const mobileNumber = normalizeMobileNumber(rawMobile);
  const existing = await prisma.user.findUnique({ where: { mobileNumber } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
      console.log(`${mobileNumber} already existed as ${existing.role} — promoted to ADMIN.`);
    } else {
      console.log(`${mobileNumber} is already an ADMIN. Nothing to do.`);
    }
  } else {
    const passwordHash = await hashPassword(createTemporaryPassword(name, mobileNumber));
    await prisma.user.create({ data: { name, mobileNumber, role: "ADMIN", passwordHash, mustChangePassword: true } });
    console.log(`Created admin: ${name} (${mobileNumber})`);
  }

  console.log("You can now log in with your mobile number and temporary password (first name + last 4 digits of mobile number).");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
