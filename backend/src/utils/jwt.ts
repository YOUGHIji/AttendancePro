import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret-change-me");
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) throw new Error("JWT_SECRET must be configured in production");

export interface JwtPayload {
  userId: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  sessionVersion: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
