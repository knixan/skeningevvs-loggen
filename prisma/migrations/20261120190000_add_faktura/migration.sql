-- Sparade fakturor (ögonblicksbild vid utfärdande) och unikt fakturanummer.
-- Bevarar all data: bara en ny tabell och nya index, inget ändras eller tas bort.
--
-- Det unika indexet på job misslyckas om två jobb redan har samma
-- fakturanummer. Kontrollera först:
--   SELECT "companyId", fakturanummer, count(*) FROM job
--   WHERE fakturanummer IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
--
-- Jobb som redan har ett fakturanummer får ingen sparad faktura här – den
-- räknas fram i appen. Fakturasidan visar "Spara faktura" för dem.

-- CreateTable
CREATE TABLE "faktura" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "customerId" TEXT,
    "fakturanummer" INTEGER NOT NULL,
    "fakturadatum" DATE NOT NULL,
    "forfallodatum" DATE NOT NULL,
    "utfardad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exklMomsOre" INTEGER NOT NULL,
    "momsOre" INTEGER NOT NULL,
    "rotAvdragOre" INTEGER NOT NULL,
    "attBetalaOre" INTEGER NOT NULL,
    "innehall" JSONB NOT NULL,

    CONSTRAINT "faktura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faktura_jobId_key" ON "faktura"("jobId");

-- CreateIndex
CREATE INDEX "faktura_companyId_fakturadatum_idx" ON "faktura"("companyId", "fakturadatum");

-- CreateIndex
CREATE INDEX "faktura_customerId_idx" ON "faktura"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "faktura_companyId_fakturanummer_key" ON "faktura"("companyId", "fakturanummer");

-- CreateIndex
CREATE UNIQUE INDEX "job_companyId_fakturanummer_key" ON "job"("companyId", "fakturanummer");

-- AddForeignKey
ALTER TABLE "faktura" ADD CONSTRAINT "faktura_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faktura" ADD CONSTRAINT "faktura_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faktura" ADD CONSTRAINT "faktura_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

