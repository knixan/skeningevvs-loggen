-- Namnen på de inlästa Ahlsell-filerna. Bara nya kolumner med standardvärde –
-- ingen befintlig data ändras.
-- AlterTable
ALTER TABLE "company" ADD COLUMN     "ahlsellAvtalFilnamn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ahlsellGrundFilnamn" TEXT NOT NULL DEFAULT '';
