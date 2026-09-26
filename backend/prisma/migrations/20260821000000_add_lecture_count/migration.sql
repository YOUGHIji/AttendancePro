-- Count continuous lectures in one attendance session.
ALTER TABLE "attendance_sessions"
  ADD COLUMN IF NOT EXISTS "lectureCount" INTEGER NOT NULL DEFAULT 1;
