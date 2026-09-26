import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { signToken } from "../utils/jwt";
import { normalizeMobileNumber } from "../utils/phone";
import { comparePassword, hashPassword } from "../utils/password";
import { logger } from "../utils/logger";

const mobileSchema = z.object({
  mobileNumber: z.string().min(10).max(15),
});

const loginSchema = z.object({
  mobileNumber: z.string().min(10).max(15),
  password: z.string().min(1).max(128),
});

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid mobile number and password." });

  const mobileNumber = normalizeMobileNumber(parsed.data.mobileNumber);

  const user = await prisma.user.findUnique({ where: { mobileNumber }, include: { studentProfile: { include: { class: true } }, parentOfStudent: { include: { class: true } } } });
  if (!user || !user.isActive) {
    logger.warn("auth.login_rejected", { reason: "unknown_or_inactive_account" });
    return res.status(401).json({ message: "Mobile number or password is incorrect." });
  }
  const valid = !!user.passwordHash && await comparePassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    logger.warn("auth.login_rejected", { reason: "incorrect_password", userId: user.id });
    return res.status(401).json({ message: "Mobile number or password is incorrect." });
  }

  const token = signToken({ userId: user.id, role: user.role, sessionVersion: user.sessionVersion });
  const linkedStudent = user.studentProfile || user.parentOfStudent;
  logger.info("auth.login_succeeded", { userId: user.id, role: user.role });
  res.json({
    token,
    user: {
      id: user.id, name: user.name, mobileNumber: user.mobileNumber, role: user.role, mustChangePassword: user.mustChangePassword,
      student: linkedStudent ? { classId: linkedStudent.classId, className: linkedStudent.class.name, rollNo: linkedStudent.rollNo } : null,
    },
  });
}

const changePasswordSchema = z.object({ password: z.string().min(8).max(128) });

export async function changePassword(req: Request, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Password must be between 8 and 128 characters." });

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !user.isActive) return res.status(401).json({ message: "Your account is no longer active." });

  const passwordHash = await hashPassword(parsed.data.password);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
  });
  const token = signToken({ userId: updated.id, role: updated.role, sessionVersion: updated.sessionVersion });
  logger.info("auth.password_changed", { userId: updated.id, role: updated.role });
  const profile = await prisma.user.findUnique({ where: { id: updated.id }, include: { studentProfile: { include: { class: true } }, parentOfStudent: { include: { class: true } } } });
  const linkedStudent = profile?.studentProfile || profile?.parentOfStudent;
  res.json({
    token,
    user: {
      id: updated.id, name: updated.name, mobileNumber: updated.mobileNumber, role: updated.role, mustChangePassword: false,
      student: linkedStudent ? { classId: linkedStudent.classId, className: linkedStudent.class.name, rollNo: linkedStudent.rollNo } : null,
    },
  });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { studentProfile: { include: { class: true } }, parentOfStudent: { include: { class: true } } },
  });
  if (!user) return res.status(404).json({ message: "User not found" });
  const linkedStudent = user.studentProfile || user.parentOfStudent;
  res.json({
    id: user.id, name: user.name, mobileNumber: user.mobileNumber, role: user.role, mustChangePassword: user.mustChangePassword,
    student: linkedStudent
      ? { classId: linkedStudent.classId, className: linkedStudent.class.name, rollNo: linkedStudent.rollNo }
      : null,
  });
}
