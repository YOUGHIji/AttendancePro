import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";

const STATUS_VALUES = ["PRESENT", "ABSENT", "LATE", "MEDICAL_LEAVE", "APPROVED_LEAVE"] as const;

const markSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(STATUS_VALUES),
});

// Teacher: single tap toggles Present/Absent; long-press picks Late/Medical/Approved leave.
// Both interactions call this same endpoint with the chosen status.
export async function markManual(req: Request, res: Response) {
  const { sessionId } = req.params;
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the attendance details and try again." });

  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId }, include: { classes: { select: { classId: true } } } });
  if (!session) return res.status(404).json({ message: "Session not found" });
  if (session.createdById !== req.user!.userId) return res.status(403).json({ message: "Not your session" });
  if (!session.isActive) return res.status(400).json({ message: "This attendance session is closed" });
  const student = await prisma.student.findFirst({ where: { id: parsed.data.studentId, classId: { in: session.classes.map((item) => item.classId) } }, select: { id: true } });
  if (!student) return res.status(400).json({ message: "Student is not part of this session" });

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId, studentId: parsed.data.studentId } },
    update: { status: parsed.data.status, source: "MANUAL", markedById: req.user!.userId, markedAt: new Date() },
    create: {
      sessionId,
      studentId: parsed.data.studentId,
      status: parsed.data.status,
      source: "MANUAL",
      markedById: req.user!.userId,
    },
  });
  res.json(record);
}
