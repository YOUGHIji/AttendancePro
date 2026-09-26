import { Router } from "express";
import { createUser, listUsers, resetUserPassword, setUserActive } from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.post("/users", asyncHandler(createUser));
router.get("/users", asyncHandler(listUsers));
router.patch("/users/:userId/active", asyncHandler(setUserActive));
router.post("/users/:userId/reset-password", asyncHandler(resetUserPassword));

export default router;
