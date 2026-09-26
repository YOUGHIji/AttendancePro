-- Roll numbers are unique within a class, but may repeat in different classes.
CREATE UNIQUE INDEX "students_classId_rollNo_key" ON "students"("classId", "rollNo");
