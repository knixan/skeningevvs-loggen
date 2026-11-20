-- Offerter: egen tabell med egna rader och en egen nummerserie.
-- Bevarar all data: bara nya tabeller, nya index och en ny kolumn med
-- standardvärde. Inget befintligt ändras eller tas bort, och
-- fakturanumreringen påverkas inte.

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "nastaOffertnummer" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "offert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "jobId" TEXT,
    "offertnummer" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'utkast',
    "offertdatum" DATE NOT NULL,
    "giltigTill" DATE NOT NULL,
    "rotAvdrag" BOOLEAN NOT NULL DEFAULT false,
    "timpris" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "milersattning" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "beraknadeTimmar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "beraknadStracka" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fastPris" DOUBLE PRECISION,
    "fastPrisArbete" DOUBLE PRECISION,
    "beskrivning" TEXT NOT NULL DEFAULT '',
    "villkor" TEXT NOT NULL DEFAULT '',
    "internaAnteckningar" TEXT NOT NULL DEFAULT '',
    "skapad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offert_artikel" (
    "id" TEXT NOT NULL,
    "offertId" TEXT NOT NULL,
    "ordning" INTEGER NOT NULL DEFAULT 0,
    "namn" TEXT NOT NULL,
    "artikelnr" TEXT NOT NULL DEFAULT '',
    "aterforsaljare" TEXT NOT NULL DEFAULT '',
    "inkopspris" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pris" DOUBLE PRECISION NOT NULL,
    "antal" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "enhet" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "offert_artikel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offert_kostnad" (
    "id" TEXT NOT NULL,
    "offertId" TEXT NOT NULL,
    "ordning" INTEGER NOT NULL DEFAULT 0,
    "beskrivning" TEXT NOT NULL,
    "pris" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "offert_kostnad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offert_jobId_key" ON "offert"("jobId");

-- CreateIndex
CREATE INDEX "offert_companyId_idx" ON "offert"("companyId");

-- CreateIndex
CREATE INDEX "offert_customerId_idx" ON "offert"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "offert_companyId_offertnummer_key" ON "offert"("companyId", "offertnummer");

-- CreateIndex
CREATE INDEX "offert_artikel_offertId_idx" ON "offert_artikel"("offertId");

-- CreateIndex
CREATE INDEX "offert_kostnad_offertId_idx" ON "offert_kostnad"("offertId");

-- AddForeignKey
ALTER TABLE "offert" ADD CONSTRAINT "offert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offert" ADD CONSTRAINT "offert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offert" ADD CONSTRAINT "offert_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offert_artikel" ADD CONSTRAINT "offert_artikel_offertId_fkey" FOREIGN KEY ("offertId") REFERENCES "offert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offert_kostnad" ADD CONSTRAINT "offert_kostnad_offertId_fkey" FOREIGN KEY ("offertId") REFERENCES "offert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

