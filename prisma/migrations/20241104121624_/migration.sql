/*
  Warnings:

  - Added the required column `updatedAt` to the `CourseDone` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `LessonDone` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CourseDone" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "LessonDone" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
