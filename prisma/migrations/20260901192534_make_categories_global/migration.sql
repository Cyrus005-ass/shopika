/*
  Warnings:

  - You are about to drop the column `store_id` on the `categories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `categories` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_store_id_fkey";

-- DropIndex
DROP INDEX "categories_store_id_slug_key";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "store_id";

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
