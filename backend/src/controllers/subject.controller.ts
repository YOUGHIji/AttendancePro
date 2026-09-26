import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";

const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  classId: z.string().uuid(),
});

export async function createSubject(req: Request, res: Response) {
  const parsed = createSubjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the subject information and try again." });
  const created = await prisma.subject.create({ data: parsed.data });
  res.status(201).json(created);
}

export async function listSubjects(req: Request, res: Response) {
  const { classId } = req.query;
  const subjects = await prisma.subject.findMany({
    where: classId ? { classId: String(classId) } : undefined,
    include: { class: true },
    orderBy: { name: "asc" },
  });
  res.json(subjects);
}

const assignSchema = z.object({
  teacherId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

// Assign a subject to a teacher
export async function assignSubjectToTeacher(req: Request, res: Response) {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the assignment information and try again." });
  const assignment = await prisma.teacherSubject.upsert({
    where: { teacherId_subjectId: parsed.data },
    update: {},
    create: parsed.data,
  });
  res.status(201).json(assignment);
}

// Teachers can use subjects created for classes by the admin. Subject ownership
// is class-based; teacher/class permissions can be added later if required.
export async function mySubjects(req: Request, res: Response) {
  const subjects = await prisma.subject.findMany({ include: { class: true }, orderBy: { name: "asc" } });
  res.json(subjects);
}
