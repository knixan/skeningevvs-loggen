-- Ahlsell-prislista. Bevarar all data: antal går från INTEGER till DOUBLE
-- PRECISION (befintliga heltal behålls exakt), övrigt är nya kolumner/tabell.
-- AlterTable
ALTER TABLE "company" ADD COLUMN     "ahlsellAntalArtiklar" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ahlsellAvtalInlast" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ahlsellAvtalSlutdatum" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ahlsellImportId" TEXT,
ADD COLUMN     "ahlsellImporteradVid" TIMESTAMP(3),
ADD COLUMN     "materialPaslag" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "article" ADD COLUMN     "enhet" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "antal" SET DEFAULT 1,
ALTER COLUMN "antal" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ahlsell_artikel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "artikelnr" TEXT NOT NULL,
    "benamning" TEXT NOT NULL,
    "enhet" TEXT NOT NULL DEFAULT '',
    "materialklass" TEXT NOT NULL DEFAULT '',
    "lagerford" BOOLEAN NOT NULL DEFAULT false,
    "bestallningsmultipel" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "grundprisOre" INTEGER NOT NULL,
    "nettoprisOre" INTEGER NOT NULL,

    CONSTRAINT "ahlsell_artikel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ahlsell_artikel_companyId_importId_idx" ON "ahlsell_artikel"("companyId", "importId");

-- AddForeignKey
ALTER TABLE "ahlsell_artikel" ADD CONSTRAINT "ahlsell_artikel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

