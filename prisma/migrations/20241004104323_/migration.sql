/*
  Warnings:

  - The values [FLIGHT_GROUP_CHAT,TEAM_GROUP_CHAT] on the enum `ConversationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `timestamp` on the `Part` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ConversationType_new" AS ENUM ('CLOUD_SAVE', 'DM', 'COURSE_GROUP_CHAT', 'GROUP_CHAT');
ALTER TABLE "Conversation" ALTER COLUMN "conversationType" TYPE "ConversationType_new" USING ("conversationType"::text::"ConversationType_new");
ALTER TYPE "ConversationType" RENAME TO "ConversationType_old";
ALTER TYPE "ConversationType_new" RENAME TO "ConversationType";
DROP TYPE "ConversationType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Part" DROP COLUMN "timestamp";
