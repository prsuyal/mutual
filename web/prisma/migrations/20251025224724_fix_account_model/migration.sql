/*
  Warnings:

  - You are about to drop the column `provider` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `providerAccountId` on the `Account` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[accountId]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountId` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `Account` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Account_provider_providerAccountId_key";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "provider",
DROP COLUMN "providerAccountId",
ADD COLUMN     "accountId" TEXT NOT NULL,
ADD COLUMN     "providerId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountId_key" ON "Account"("accountId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
