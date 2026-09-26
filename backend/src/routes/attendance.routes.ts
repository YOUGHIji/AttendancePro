import { Router } from "express";
import { markManual } from "../controllers/attendance.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

// Teacher: manual mark / correct (tap = Present/Absent, long-press = Late/Medical/Approved)
router.post("/sessions/:sessionId/mark", requireAuth, requireRole("TEACHER"), asyncHandler(markManual));

export default router;
