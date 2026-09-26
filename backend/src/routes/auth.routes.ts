import { Router } from "express";
import { login, changePassword, me } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/change-password", requireAuth, asyncHandler(changePassword));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
