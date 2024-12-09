/*
  Warnings:

  - You are about to drop the column `attachmentId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `lessonId` on the `File` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "File" DROP COLUMN "attachmentId",
DROP COLUMN "lessonId";
