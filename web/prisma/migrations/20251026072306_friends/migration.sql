/*
  Warnings:

  - You are about to drop the column `tags` on the `Review` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Verification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "idToken" TEXT,
ADD COLUMN     "scope" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "tags";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "friends" TEXT[],
ADD COLUMN     "incomingRequests" TEXT[],
ADD COLUMN     "outgoingRequests" TEXT[],
ALTER COLUMN "emailVerified" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Verification" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
