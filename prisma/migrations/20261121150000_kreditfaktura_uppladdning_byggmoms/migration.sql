-- Kreditfakturor (#28), registrerade uppladdningar (#5, #19), omvänd
-- byggmoms (#11) och BRF:ens organisationsnummer för ROT (#38).
--
-- Bevarar all data:
-- - Nya kolumner har standardvärden, nya tabellen fylls med de filer som
--   redan används (jobbilder och logotyper), markerade som använda.
-- - Det unika indexet på faktura.jobId byts mot ett vanligt index, så att ett
--   jobb kan ha en krediterad faktura och en ny. Inga rader ändras.
-- - Fakturanumren påverkas inte.

-- DropIndex
DROP INDEX "faktura_jobId_key";

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "brfOrgNummer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "momsNummer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "omvandByggmoms" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "faktura" ADD COLUMN     "krediterarId" TEXT;

-- CreateTable
CREATE TABLE "uppladdning" (
    "key" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "typ" TEXT NOT NULL,
    "anvand" BOOLEAN NOT NULL DEFAULT false,
    "skapad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uppladdning_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "uppladdning_companyId_idx" ON "uppladdning"("companyId");

-- CreateIndex
CREATE INDEX "uppladdning_anvand_skapad_idx" ON "uppladdning"("anvand", "skapad");

-- CreateIndex
CREATE UNIQUE INDEX "faktura_krediterarId_key" ON "faktura"("krediterarId");

-- CreateIndex
CREATE INDEX "faktura_jobId_idx" ON "faktura"("jobId");

-- AddForeignKey
ALTER TABLE "faktura" ADD CONSTRAINT "faktura_krediterarId_fkey" FOREIGN KEY ("krediterarId") REFERENCES "faktura"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uppladdning" ADD CONSTRAINT "uppladdning_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Befintliga filer räknas som använda, så att de aldrig städas bort och kan
-- sparas igen när ett jobb eller företaget redigeras.
INSERT INTO "uppladdning" ("key", "companyId", "url", "typ", "anvand")
SELECT i."key", j."companyId", i."url", 'jobbild', true
FROM "job_image" i
JOIN "job" j ON j."id" = i."jobId"
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "uppladdning" ("key", "companyId", "url", "typ", "anvand")
SELECT "logoKey", "id", "logoUrl", 'logotyp', true
FROM "company"
WHERE "logoKey" <> ''
ON CONFLICT ("key") DO NOTHING;
