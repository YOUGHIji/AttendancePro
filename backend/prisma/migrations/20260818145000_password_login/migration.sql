-- Add password-based login and server-side session invalidation.
-- passwordHash remains nullable until the one-time initialization script runs.
ALTER TABLE "users"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
