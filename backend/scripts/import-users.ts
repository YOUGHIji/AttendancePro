/**
 * Bulk-import teachers and students from a CSV file.
 *
 * Usage:
 *   npx ts-node scripts/import-users.ts scripts/sample-users.csv
 *
 * Supported CSV header formats (header row required):
 *   name,mobileNumber,role,className,rollNo
 * or a school register export such as:
 *   Roll No,Student Name,Phone Number,Standard
 *
 * - role must be TEACHER or STUDENT (use scripts/seed-admin.ts for the admin account)
 * - className and rollNo only matter for STUDENT rows; className is created automatically
 *   if it doesn't exist yet
 * - mobileNumber can be a bare 10-digit Indian number (91 is added automatically) or
 *   already include the country code
 *
 * Each account receives a temporary password: first name + last 4 mobile digits.
 * The account holder must replace it on their first sign-in.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/config/db";
import { normalizeMobileNumber } from "../src/utils/phone";
import { createTemporaryPassword, hashPassword } from "../src/utils/password";

interface CsvRow {
  name?: string;
  mobileNumber?: string;
  role?: "TEACHER" | "STUDENT";
  className?: string;
  rollNo?: string;
  "Roll No"?: string;
  "Student Name"?: string;
  "Phone Number"?: string;
  Standard?: string;
}

interface ValidRow extends CsvRow {
  name: string;
  mobileNumber: string;
  role: "TEACHER" | "STUDENT";
  className?: string;
  rollNo?: string;
}

function normaliseClassName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function classNameFromStandard(standard?: string) {
  const value = standard?.trim();
  if (!value) return undefined;
  return /^\d+$/.test(value) ? `${value}th` : normaliseClassName(value);
}

function validateRows(rows: CsvRow[]): ValidRow[] {
  const errors: string[] = [];
  const mobileNumbers = new Set<string>();
  const classRollNumbers = new Set<string>();
  const validRows: ValidRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = row.name?.trim() || row["Student Name"]?.trim() || "";
    // A school-register file represents students, so its role is added automatically.
    const role = (row.role || (row["Student Name"] ? "STUDENT" : "")).toUpperCase() as "TEACHER" | "STUDENT";
    const digits = (row.mobileNumber || row["Phone Number"] || "").replace(/\D/g, "");
    const mobileNumber = normalizeMobileNumber(digits);
    const className = row.className ? normaliseClassName(row.className) : classNameFromStandard(row.Standard);
    const rollNo = row.rollNo?.trim() || row["Roll No"]?.trim();

    if (!name) errors.push(`Row ${rowNumber}: name is required.`);
    if (role !== "TEACHER" && role !== "STUDENT") errors.push(`Row ${rowNumber}: role must be TEACHER or STUDENT.`);
    if (mobileNumber.length !== 12 || !mobileNumber.startsWith("91")) errors.push(`Row ${rowNumber}: mobile number must be a 10-digit Indian number.`);
    if (mobileNumbers.has(mobileNumber)) errors.push(`Row ${rowNumber}: this mobile number appears more than once in the CSV.`);
    mobileNumbers.add(mobileNumber);

    if (role === "STUDENT") {
      if (!className) errors.push(`Row ${rowNumber}: STUDENT rows need a className.`);
      if (!rollNo) errors.push(`Row ${rowNumber}: STUDENT rows need a rollNo.`);
      if (className && rollNo) {
        const classRollKey = `${className.toLowerCase()}::${rollNo.toLowerCase()}`;
        if (classRollNumbers.has(classRollKey)) errors.push(`Row ${rowNumber}: roll number ${rollNo} is repeated in ${className}.`);
        classRollNumbers.add(classRollKey);
      }
    }

    validRows.push({ name, mobileNumber, role, className, rollNo });
  });

  if (errors.length) {
    console.error("The CSV was not imported. Fix these issues first:\n" + errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }
  return validRows;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx ts-node scripts/import-users.ts <path-to-csv>");
    process.exit(1);
  }

  const fullPath = path.resolve(csvPath);
  const fileContent = fs.readFileSync(fullPath, "utf-8");
  const parsedRows: CsvRow[] = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
  const rows = validateRows(parsedRows);

  if (!rows.length) {
    console.error("The CSV has no data rows to import.");
    process.exit(1);
  }

  const existingUsers = await prisma.user.findMany({
    where: { mobileNumber: { in: rows.map((row) => row.mobileNumber) } },
    select: { mobileNumber: true },
  });
  if (existingUsers.length) {
    console.error("The CSV was not imported because these mobile numbers already exist: " + existingUsers.map((user) => user.mobileNumber).join(", "));
    process.exit(1);
  }

  const studentRows = rows.filter((row) => row.role === "STUDENT");
  const existingStudents = await prisma.student.findMany({
    where: { class: { name: { in: studentRows.map((row) => row.className!).filter(Boolean) } } },
    include: { class: { select: { name: true } } },
  });
  const existingClassRolls = new Set(existingStudents.map((student) => `${student.class.name.toLowerCase()}::${(student.rollNo || "").toLowerCase()}`));
  const clashes = studentRows.filter((row) => existingClassRolls.has(`${row.className!.toLowerCase()}::${row.rollNo!.toLowerCase()}`));
  if (clashes.length) {
    console.error("The CSV was not imported because these class and roll-number combinations already exist: " + clashes.map((row) => `${row.className} - Roll ${row.rollNo}`).join(", "));
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const { role, mobileNumber } = row;

    let classId: string | undefined;
    if (role === "STUDENT") {
      let cls = await prisma.class.findFirst({ where: { name: row.className } });
      if (!cls) {
        cls = await prisma.class.create({ data: { name: row.className! } });
        console.log(`Created class: ${row.className!}`);
      }
      classId = cls.id;
    }

    const passwordHash = await hashPassword(createTemporaryPassword(row.name, mobileNumber));
    await prisma.user.create({
      data: {
        name: row.name,
        mobileNumber,
        role,
        passwordHash,
        mustChangePassword: true,
        ...(role === "STUDENT" ? { studentProfile: { create: { classId: classId!, rollNo: row.rollNo! } } } : {}),
      },
    });
    console.log(`Created ${role.toLowerCase()}: ${row.name} (${mobileNumber})`);
    created++;
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
  await prisma.$disconnect();
}

main().catch(async () => {
  console.error("Could not import the CSV. Check that the database is online, then try again.");
  await prisma.$disconnect();
  process.exit(1);
});
