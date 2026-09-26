import { Router } from "express";
import { myAttendance, mySchedule } from "../controllers/student.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.get("/attendance", requireAuth, requireRole("STUDENT", "PARENT"), asyncHandler(myAttendance));
router.get("/schedule", requireAuth, requireRole("STUDENT", "PARENT"), asyncHandler(mySchedule));

export default router;
