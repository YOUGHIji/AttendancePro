import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// Wrap async route handlers so thrown errors reach the error middleware
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type KnownError = Error & { code?: string; status?: number; statusCode?: number };

function clientError(err: KnownError) {
  if (err.code === "P2002") return { status: 409, message: "A record with these details already exists." };
  if (err.code === "P2025") return { status: 404, message: "The requested record was not found." };

  // Prisma connection, query-engine and validation failures must never expose
  // database host names, local paths, or stack traces to a phone.
  if (err.name.startsWith("PrismaClient")) {
    return { status: 503, message: "AttendancePro is temporarily unavailable. Please try again shortly." };
  }

  const status = err.statusCode ?? err.status;
  if (Number.isInteger(status) && status! >= 400 && status! < 500) {
    return { status: status!, message: "We could not complete that request. Please check the information and try again." };
  }

  return { status: 500, message: "Something went wrong. Please try again shortly." };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  const error: KnownError = err instanceof Error ? (err as KnownError) : (new Error(String(err)) as KnownError);
  const requestId = res.getHeader("X-Request-Id")?.toString();
  const response = clientError(error);

  logger.error("request.failed", error, {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: response.status,
    errorCode: error.code,
  });

  res.status(response.status).json({ message: response.message, requestId });
}
