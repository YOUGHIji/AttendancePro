import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../config/db";
import { logger } from "../utils/logger";

// Verifies the JWT sent in the Authorization header and attaches the user to req.user
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }
  const token = header.slice("Bearer ".length);

  // A bad token is expected client input. Keep it separate from database or
  // server failures so a database outage is not reported as a login problem.
  let tokenPayload;
  try {
    tokenPayload = verifyToken(token);
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: tokenPayload.userId } });
    if (!user || !user.isActive || user.sessionVersion !== tokenPayload.sessionVersion) {
      return res.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
    }
    req.user = { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
    next();
  } catch (error) {
    logger.error("auth.session_validation_failed", error, { path: req.path });
    next(error);
  }
}

// Restricts a route to specific roles. Use after requireAuth.
export function requireRole(...roles: Array<"ADMIN" | "TEACHER" | "STUDENT" | "PARENT">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to do that." });
    }
    next();
  };
}
