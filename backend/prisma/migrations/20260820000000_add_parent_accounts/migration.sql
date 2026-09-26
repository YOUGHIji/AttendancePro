-- Add parent accounts without changing existing users or attendance data.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PARENT';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentOfStudentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_parentOfStudentId_key"
  ON "users"("parentOfStudentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_parentOfStudentId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_parentOfStudentId_fkey"
      FOREIGN KEY ("parentOfStudentId") REFERENCES "students"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
