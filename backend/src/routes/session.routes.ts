import { Router } from "express";
import {
  createSession,
  closeSession,
  cancelSession,
  listMySessions,
  getSession,
} from "../controllers/session.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post("/", requireAuth, requireRole("TEACHER"), asyncHandler(createSession));
router.get("/mine", requireAuth, requireRole("TEACHER"), asyncHandler(listMySessions));
router.get("/:sessionId", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(getSession));
router.post("/:sessionId/close", requireAuth, requireRole("TEACHER"), asyncHandler(closeSession));
router.delete("/:sessionId", requireAuth, requireRole("TEACHER"), asyncHandler(cancelSession));

export default router;
