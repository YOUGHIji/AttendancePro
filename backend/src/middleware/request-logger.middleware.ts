import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    logger.info("request.completed", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
    });
  });

  next();
}
