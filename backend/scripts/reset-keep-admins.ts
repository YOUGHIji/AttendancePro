/**
 * Removes all operational AttendancePro data while preserving every ADMIN user.
 *
 * Preview only:
 *   npm run reset:keep-admins
 *
 * Perform deletion:
 *   npm run reset:keep-admins -- --confirm
 */
import "dotenv/config";
import { prisma } from "../src/config/db";

const confirmed = process.argv.includes("--confirm");

async function counts() {
  const [admins, nonAdmins, classes, subjects, teacherAssignments, sessions, sessionClasses, attendanceRecords] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: { not: "ADMIN" } } }),
    prisma.class.count(),
    prisma.subject.count(),
    prisma.teacherSubject.count(),
    prisma.attendanceSession.count(),
    prisma.attendanceSessionClass.count(),
    prisma.attendanceRecord.count(),
  ]);
  return { admins, nonAdmins, classes, subjects, teacherAssignments, sessions, sessionClasses, attendanceRecords };
}

async function main() {
  const before = await counts();
  console.log("AttendancePro reset summary:");
  console.table({
    "Administrator accounts preserved": before.admins,
    "Non-admin accounts to remove": before.nonAdmins,
    "Classes to remove": before.classes,
    "Subjects to remove": before.subjects,
    "Teacher-subject assignments to remove": before.teacherAssignments,
    "Attendance sessions to remove": before.sessions,
    "Session-class links to remove": before.sessionClasses,
    "Attendance records to remove": before.attendanceRecords,
  });

  if (!confirmed) {
    console.log("Preview only. Nothing was removed. Run again with --confirm to perform this reset.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.deleteMany();
    await tx.attendanceSessionClass.deleteMany();
    await tx.attendanceSession.deleteMany();
    await tx.teacherSubject.deleteMany();

    // Parent accounts are removed before student profiles because a parent can
    // hold a reference to the linked student.
    await tx.user.deleteMany({ where: { role: "PARENT" } });
    await tx.user.deleteMany({ where: { role: "STUDENT" } });
    await tx.user.deleteMany({ where: { role: "TEACHER" } });
    await tx.user.deleteMany({ where: { role: { not: "ADMIN" } } });

    await tx.subject.deleteMany();
    await tx.class.deleteMany();
  });

  const after = await counts();
  console.log("Reset complete. Remaining administrator accounts:", after.admins);
}

main()
  .catch(() => {
    console.error("Could not reset AttendancePro data. Check that the database is online, then try again.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
