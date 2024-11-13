/*
  Warnings:

  - You are about to drop the column `emojiIconId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the `Emoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmojiIcon` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Emoji" DROP CONSTRAINT "Emoji_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Emoji" DROP CONSTRAINT "Emoji_emojiId_fkey";

-- DropForeignKey
ALTER TABLE "Emoji" DROP CONSTRAINT "Emoji_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "Emoji" DROP CONSTRAINT "Emoji_messageId_fkey";

-- DropForeignKey
ALTER TABLE "Emoji" DROP CONSTRAINT "Emoji_userId_fkey";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "emojiIconId";

-- DropTable
DROP TABLE "Emoji";

-- DropTable
DROP TABLE "EmojiIcon";
