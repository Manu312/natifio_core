-- CreateEnum
CREATE TYPE "Attendance" AS ENUM ('PRESENT', 'ABSENT');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "attendance" "Attendance",
ADD COLUMN     "attendanceAt" TIMESTAMP(3),
ADD COLUMN     "attendanceBy" TEXT;

-- CreateIndex
CREATE INDEX "Availability_teacherId_dayOfWeek_idx" ON "Availability"("teacherId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Booking_teacherId_date_status_idx" ON "Booking"("teacherId", "date", "status");

-- CreateIndex
CREATE INDEX "Booking_studentId_idx" ON "Booking"("studentId");

-- CreateIndex
CREATE INDEX "Booking_recurringGroupId_idx" ON "Booking"("recurringGroupId");

-- CreateIndex
CREATE INDEX "Booking_date_idx" ON "Booking"("date");

-- CreateIndex
CREATE INDEX "RecurringGroup_studentId_idx" ON "RecurringGroup"("studentId");

-- CreateIndex
CREATE INDEX "RecurringGroup_teacherId_idx" ON "RecurringGroup"("teacherId");

-- CreateIndex
CREATE INDEX "Student_firstName_lastName_idx" ON "Student"("firstName", "lastName");
