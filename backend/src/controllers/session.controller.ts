import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";

const createSessionSchema = z.object({
  subjectId: z.string().uuid(),
  classIds: z.array(z.string().uuid()).min(1).refine((ids) => new Set(ids).size === ids.length, "Duplicate classes are not allowed"), // supports single or multi-class events
  sessionDate: z.string(), // ISO date
  durationMinutes: z.number().int().min(5).max(480).default(40),
  lectureCount: z.number().int().min(1).max(12).default(1),
  eventName: z.string().trim().max(120).optional(),
});

// Teacher: Select class(es) -> subject -> date/time -> optional event -> Create session
export async function createSession(req: Request, res: Response) {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the session details and try again." });
  const { subjectId, classIds, sessionDate, durationMinutes, lectureCount, eventName } = parsed.data;
  const startDate = new Date(sessionDate);
  if (Number.isNaN(startDate.getTime())) return res.status(400).json({ message: "Invalid session date" });
  if (startDate > new Date()) return res.status(400).json({ message: "A future date or time cannot be used for attendance" });
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return res.status(404).json({ message: "Subject not found" });
  if (!classIds.includes(subject.classId)) {
    return res.status(400).json({ message: "Select the class linked to this subject" });
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.attendanceSession.create({
      data: {
        subjectId,
        createdById: req.user!.userId,
        sessionDate: startDate,
        lectureCount,
        endTime: new Date(startDate.getTime() + durationMinutes * lectureCount * 60 * 1000),
        eventName,
        classes: { create: classIds.map((classId) => ({ classId })) },
      },
      include: { classes: { include: { class: true } }, subject: true },
    });
    const students = await tx.student.findMany({ where: { classId: { in: classIds } } });
    if (students.length > 0) {
      await tx.attendanceRecord.createMany({
        data: students.map((s) => ({ sessionId: created.id, studentId: s.id, status: "ABSENT" as const })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  res.status(201).json(session);
}

export async function closeSession(req: Request, res: Response) {
  const { sessionId } = req.params;
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ message: "Session not found" });
  if (session.createdById !== req.user!.userId) return res.status(403).json({ message: "Not your session" });
  if (!session.isActive) return res.status(400).json({ message: "This session is already closed" });

  const updated = await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: { isActive: false, endTime: new Date(), qrToken: null, qrExpiresAt: null },
  });
  res.json(updated);
}

export async function cancelSession(req: Request, res: Response) {
  const { sessionId } = req.params;
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ message: "Session not found" });
  if (session.createdById !== req.user!.userId) return res.status(403).json({ message: "Not your session" });
  if (!session.isActive) return res.status(400).json({ message: "This session is already closed" });
  await prisma.attendanceSession.delete({ where: { id: sessionId } });
  res.status(204).send();
}

// Teacher's session history
export async function listMySessions(req: Request, res: Response) {
  const sessions = await prisma.attendanceSession.findMany({
    where: { createdById: req.user!.userId },
    include: {
      subject: true,
      classes: { include: { class: true } },
      _count: { select: { records: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(sessions);
}

export async function getSession(req: Request, res: Response) {
  const { sessionId } = req.params;
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      subject: true,
      classes: { include: { class: true } },
      records: { include: { student: { select: { id: true, rollNo: true, user: { select: { id: true, name: true } } } } } },
    },
  });
  if (!session) return res.status(404).json({ message: "Session not found" });
  if (req.user!.role === "TEACHER" && session.createdById !== req.user!.userId) return res.status(403).json({ message: "Not your session" });
  res.json(session);
}
