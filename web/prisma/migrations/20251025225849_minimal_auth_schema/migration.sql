/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `googleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Account_userId_idx";

-- DropIndex
DROP INDEX "public"."User_googleId_key";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "password" TEXT;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "createdAt",
DROP COLUMN "ipAddress",
DROP COLUMN "updatedAt",
DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified",
DROP COLUMN "googleId",
DROP COLUMN "updatedAt";
