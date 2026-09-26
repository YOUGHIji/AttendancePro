import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { normalizeMobileNumber } from "../utils/phone";
import { createTemporaryPassword, hashPassword } from "../utils/password";

const createUserSchema = z.object({
  name: z.string().min(2),
  mobileNumber: z.string().min(10).max(15),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"]),
  classId: z.string().uuid().optional(), // required when role === STUDENT
  rollNo: z.string().optional(),
  parentStudentId: z.string().uuid().optional(),
});

// Admin provisions an account with a temporary password. The account holder must
// replace it with a private password on first sign-in.
export async function createUser(req: Request, res: Response) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the information and try again." });
  const { name, role, classId, rollNo, parentStudentId } = parsed.data;
  const mobileNumber = normalizeMobileNumber(parsed.data.mobileNumber);

  const existing = await prisma.user.findUnique({ where: { mobileNumber } });
  if (existing) {
    return res.status(409).json({ message: "This mobile number is already registered" });
  }
  if (role === "STUDENT" && !classId) {
    return res.status(400).json({ message: "classId is required when adding a student" });
  }
  if (role === "PARENT" && !parentStudentId) {
    return res.status(400).json({ message: "Select the student for this parent account" });
  }
  const temporaryPassword = createTemporaryPassword(name, mobileNumber);
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await prisma.user.create({
    data: {
      name,
      mobileNumber,
      role,
      passwordHash,
      mustChangePassword: true,
      ...(role === "STUDENT" && classId ? { studentProfile: { create: { classId, rollNo } } } : {}),
      ...(role === "PARENT" && parentStudentId ? { parentOfStudent: { connect: { id: parentStudentId } } } : {}),
    },
    include: { studentProfile: { include: { class: true } }, parentOfStudent: { include: { class: true } } },
  });

  const { passwordHash: _passwordHash, ...safeUser } = user;
  res.status(201).json({ ...safeUser, temporaryPassword });
}

export async function listUsers(req: Request, res: Response) {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: String(role) as any } : undefined,
    select: {
      id: true, name: true, mobileNumber: true, role: true, mustChangePassword: true,
      isActive: true, createdAt: true,
      studentProfile: { select: { id: true, classId: true, rollNo: true, class: { select: { id: true, name: true, section: true } } } },
      parentOfStudent: { select: { id: true, classId: true, rollNo: true, class: { select: { id: true, name: true, section: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
}

const setActiveSchema = z.object({ isActive: z.boolean() });

// Deactivate/reactivate an account without deleting their attendance history
export async function setUserActive(req: Request, res: Response) {
  const { userId } = req.params;
  const parsed = setActiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the information and try again." });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: parsed.data.isActive, sessionVersion: { increment: 1 } },
  });
  const { passwordHash: _passwordHash, ...safeUser } = updated;
  res.json(safeUser);
}

export async function resetUserPassword(req: Request, res: Response) {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: "User not found" });

  const temporaryPassword = createTemporaryPassword(user.name, user.mobileNumber);
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
  });
  res.json({ temporaryPassword });
}
