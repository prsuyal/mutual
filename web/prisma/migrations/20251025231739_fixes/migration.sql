/*
  Warnings:

  - Added the required column `updatedAt` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Made the column `password` on table `Account` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "password" SET NOT NULL;
