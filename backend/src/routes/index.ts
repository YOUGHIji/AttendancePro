import { Router } from "express";
import authRoutes from "./auth.routes";
import classRoutes from "./class.routes";
import subjectRoutes from "./subject.routes";
import sessionRoutes from "./session.routes";
import attendanceRoutes from "./attendance.routes";
import studentRoutes from "./student.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/classes", classRoutes);
router.use("/subjects", subjectRoutes);
router.use("/sessions", sessionRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/student", studentRoutes);
router.use("/admin", adminRoutes);

export default router;
