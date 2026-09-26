import { Router } from "express";
import { createSubject, listSubjects, assignSubjectToTeacher, mySubjects } from "../controllers/subject.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.get("/", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(listSubjects));
router.post("/", requireAuth, requireRole("ADMIN"), asyncHandler(createSubject));
router.post("/assign", requireAuth, requireRole("ADMIN"), asyncHandler(assignSubjectToTeacher));
router.get("/mine", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(mySubjects));

export default router;
