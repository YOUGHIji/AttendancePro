import { Router } from "express";
import { listClasses, createClass, getClassStudents, getStudentAttendanceSummary, getClassAttendanceReport, addStudentToClass } from "../controllers/class.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.get("/", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(listClasses));
router.post("/", requireAuth, requireRole("ADMIN"), asyncHandler(createClass));
router.get("/:classId/students", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(getClassStudents));
router.get("/:classId/students/:studentId/attendance", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(getStudentAttendanceSummary));
router.get("/:classId/attendance-report", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(getClassAttendanceReport));
router.post("/:classId/students", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(addStudentToClass));

export default router;
