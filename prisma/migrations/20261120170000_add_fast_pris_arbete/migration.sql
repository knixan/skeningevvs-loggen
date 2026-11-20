-- AlterTable
-- Ny kolumn utan standardvärde: befintliga jobb får NULL och ändras inte.
ALTER TABLE "job" ADD COLUMN "fastPrisArbete" DOUBLE PRECISION;
