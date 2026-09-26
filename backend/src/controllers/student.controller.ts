import { Request, Response } from "express";
import { prisma } from "../config/db";

// Student's own attendance history + overall & per-subject percentage
export async function myAttendance(req: Request, res: Response) {
  const student = await prisma.student.findFirst({ where: { OR: [{ userId: req.user!.userId }, { parent: { id: req.user!.userId } }] } });
  if (!student) return res.status(403).json({ message: "Only students can view attendance history" });

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id },
    include: { session: { include: { subject: true } } },
    orderBy: { markedAt: "desc" },
  });

  const total = records.reduce((sum, r) => sum + r.session.lectureCount, 0);
  const present = records.reduce((sum, r) => sum + (r.status === "PRESENT" || r.status === "LATE" ? r.session.lectureCount : 0), 0);
  const overallPercentage = total > 0 ? Math.round((present / total) * 10000) / 100 : 0;

  // Per-subject breakdown. Start with every subject assigned to the
  // student's class so subjects with no lecture yet still count on Home.
  const classSubjects = await prisma.subject.findMany({
    where: { classId: student.classId },
    select: { id: true, name: true },
  });
  const bySubject: Record<string, { subjectName: string; total: number; present: number }> = {};
  for (const subject of classSubjects) {
    bySubject[subject.id] = { subjectName: subject.name, total: 0, present: 0 };
  }
  for (const r of records) {
    const key = r.session.subjectId;
    if (!bySubject[key]) bySubject[key] = { subjectName: r.session.subject.name, total: 0, present: 0 };
    bySubject[key].total += r.session.lectureCount;
    if (r.status === "PRESENT" || r.status === "LATE") bySubject[key].present += r.session.lectureCount;
  }
  const subjectBreakdown = Object.entries(bySubject).map(([subjectId, v]) => ({
    subjectId,
    subjectName: v.subjectName,
    total: v.total,
    present: v.present,
    percentage: v.total > 0 ? Math.round((v.present / v.total) * 10000) / 100 : 0,
  }));

  res.json({
    overallPercentage,
    totalSessions: total,
    presentCount: present,
    subjectBreakdown,
    history: records.map((r) => ({
      recordId: r.id,
      status: r.status,
      source: r.source,
      markedAt: r.markedAt,
      sessionDate: r.session.sessionDate,
      subjectName: r.session.subject.name,
      eventName: r.session.eventName,
      lectureCount: r.session.lectureCount,
    })),
  });
}

// All sessions for the student's class, including whether this student attended.
export async function mySchedule(req: Request, res: Response) {
  const student = await prisma.student.findFirst({ where: { OR: [{ userId: req.user!.userId }, { parent: { id: req.user!.userId } }] } });
  if (!student) return res.status(403).json({ message: "Only students can view their schedule" });

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      classes: { some: { classId: student.classId } },
      sessionDate: { gte: startOfToday, lt: startOfTomorrow },
    },
    include: {
      subject: true,
      classes: { include: { class: true } },
      records: { where: { studentId: student.id }, select: { status: true } },
    },
    orderBy: { sessionDate: "asc" },
  });

  res.json({
    className: (await prisma.class.findUnique({ where: { id: student.classId } }))?.name || "",
    sessions: sessions.map((session) => ({
      id: session.id,
      subjectName: session.subject.name,
      eventName: session.eventName,
      sessionDate: session.sessionDate,
      endTime: session.endTime,
      lectureCount: session.lectureCount,
      isActive: session.isActive,
      status: session.isActive || session.sessionDate > new Date() ? "NOT_MARKED" : (session.records[0]?.status || "NOT_MARKED"),
    })),
  });
}
