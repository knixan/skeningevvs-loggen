-- Beräkningsgrunden kan bestå av flera filer. Kolumnen blir en lista; ett
-- sparat filnamn blir en lista med det namnet, ett tomt blir en tom lista.
-- Ingen data försvinner.
ALTER TABLE "company" ALTER COLUMN "ahlsellGrundFilnamn" DROP DEFAULT;
ALTER TABLE "company" ALTER COLUMN "ahlsellGrundFilnamn" SET DATA TYPE TEXT[]
  USING (
    CASE WHEN "ahlsellGrundFilnamn" = '' THEN ARRAY[]::TEXT[]
    ELSE ARRAY["ahlsellGrundFilnamn"] END
  );
ALTER TABLE "company" ALTER COLUMN "ahlsellGrundFilnamn" SET DEFAULT ARRAY[]::TEXT[];
