import { Request, Response } from "express";
import { prisma } from "../config/db";
import { z } from "zod";

export async function listClasses(req: Request, res: Response) {
  const classes = await prisma.class.findMany({
    include: { _count: { select: { students: true } } },
    orderBy: { name: "asc" },
  });
  res.json(classes);
}

const createClassSchema = z.object({
  name: z.string().min(1),
  section: z.string().optional(),
});

export async function createClass(req: Request, res: Response) {
  const parsed = createClassSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the class information and try again." });
  const created = await prisma.class.create({ data: parsed.data });
  res.status(201).json(created);
}

export async function getClassStudents(req: Request, res: Response) {
  const { classId } = req.params;
  const students = await prisma.student.findMany({
    where: { classId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { rollNo: "asc" },
  });
  res.json(students);
}

export async function getStudentAttendanceSummary(req: Request, res: Response) {
  const { classId, studentId } = req.params;
  const student = await prisma.student.findFirst({ where: { id: studentId, classId } });
  if (!student) return res.status(404).json({ message: "Student not found in this class" });

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId },
    include: { session: { include: { subject: true } } },
    orderBy: { session: { sessionDate: "desc" } },
  });
  const present = (status: string) => status === "PRESENT" || status === "LATE";
  const classSubjects = await prisma.subject.findMany({ where: { classId }, select: { id: true, name: true } });
  const subjectMap: Record<string, { name: string; total: number; attended: number }> = {};
  classSubjects.forEach((subject) => { subjectMap[subject.id] = { name: subject.name, total: 0, attended: 0 }; });
  records.forEach((record) => {
    const entry = subjectMap[record.session.subjectId] || (subjectMap[record.session.subjectId] = { name: record.session.subject.name, total: 0, attended: 0 });
    entry.total += record.session.lectureCount;
    if (present(record.status)) entry.attended += record.session.lectureCount;
  });
  const months: Record<string, { total: number; attended: number }> = {};
  records.forEach((record) => {
    const date = new Date(record.session.sessionDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const entry = months[key] || (months[key] = { total: 0, attended: 0 });
    entry.total += record.session.lectureCount;
    if (present(record.status)) entry.attended += record.session.lectureCount;
  });
  const total = records.reduce((sum, record) => sum + record.session.lectureCount, 0);
  const attended = records.reduce((sum, record) => sum + (present(record.status) ? record.session.lectureCount : 0), 0);
  res.json({
    student: { id: student.id, name: (await prisma.user.findUnique({ where: { id: student.userId }, select: { name: true } }))?.name || "", rollNo: student.rollNo },
    overall: { total, attended, percentage: total ? Math.round((attended / total) * 100) : 0 },
    monthly: Object.entries(months).map(([month, value]) => ({ month, ...value, percentage: value.total ? Math.round((value.attended / value.total) * 100) : 0 })),
    subjects: Object.entries(subjectMap).map(([subjectId, value]) => ({ subjectId, subjectName: value.name, total: value.total, attended: value.attended, percentage: value.total ? Math.round((value.attended / value.total) * 100) : 0 })),
  });
}

const reportQuerySchema = z.object({
  period: z.enum(["OVERALL", "MONTH"]).default("OVERALL"),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  mode: z.enum(["NORMAL", "DEFAULTERS"]).default("NORMAL"),
  threshold: z.coerce.number().min(0).max(100).default(60),
});

export async function getClassAttendanceReport(req: Request, res: Response) {
  const { classId } = req.params;
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid report options" });
  const { period, month, mode, threshold } = parsed.data;
  if (period === "MONTH" && !month) return res.status(400).json({ message: "Select a month" });

  const classRecord = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
  if (!classRecord) return res.status(404).json({ message: "Class not found" });
  const students = await prisma.student.findMany({
    where: { classId },
    include: { user: { select: { name: true } } },
    orderBy: { rollNo: "asc" },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: { student: { classId }, ...(period === "MONTH" ? { session: { sessionDate: { gte: new Date(`${month}-01T00:00:00.000Z`), lt: new Date(new Date(`${month}-01T00:00:00.000Z`).setUTCMonth(new Date(`${month}-01T00:00:00.000Z`).getUTCMonth() + 1)) } } } : {}) },
    include: { session: { select: { lectureCount: true } } },
  });
  const totals = new Map<string, { total: number; attended: number }>();
  records.forEach((record) => {
    const value = totals.get(record.studentId) || { total: 0, attended: 0 };
    value.total += record.session.lectureCount;
    if (record.status === "PRESENT" || record.status === "LATE") value.attended += record.session.lectureCount;
    totals.set(record.studentId, value);
  });
  const rows = students.map((student) => {
    const value = totals.get(student.id) || { total: 0, attended: 0 };
    return { name: student.user.name, rollNo: student.rollNo || "", totalLectures: value.total, attendedLectures: value.attended, percentage: value.total ? Math.round((value.attended / value.total) * 100) : 0 };
  }).filter((row) => mode === "NORMAL" || row.percentage < threshold).sort((a, b) => {
    const aRoll = Number.parseInt(a.rollNo, 10); const bRoll = Number.parseInt(b.rollNo, 10);
    if (Number.isNaN(aRoll) && Number.isNaN(bRoll)) return a.name.localeCompare(b.name);
    if (Number.isNaN(aRoll)) return 1;
    if (Number.isNaN(bRoll)) return -1;
    return aRoll - bRoll;
  });
  res.json({ class: classRecord, period, month: month || null, mode, threshold, rows });
}

const addStudentSchema = z.object({
  userId: z.string().uuid(),
  rollNo: z.string().optional(),
});

// Associate an existing student user with this class (e.g. moving sections)
export async function addStudentToClass(req: Request, res: Response) {
  const { classId } = req.params;
  const parsed = addStudentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the student information and try again." });

  const updated = await prisma.student.update({
    where: { userId: parsed.data.userId },
    data: { classId, rollNo: parsed.data.rollNo },
  });
  res.json(updated);
}
