<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Regler för AI-agenter i det här repot

Skriv på **svenska**: UI-texter, kommentarer, kanban-kort och commit-meddelanden. Variabel- och funktionsnamn följer koden runt omkring (blandat svenska och engelska). README:n är på engelska – håll den så.

## Vad appen är

Jobb-, kund- och fakturalogg för **en enda VVS-firma med en enda användare** (Skeninge VVS). Ingen multi-tenancy, inga team, ingen prenumeration, ingen e-postutskick. Bygg inte in sådant "för framtiden".

En vanlig Next.js-app (inte monorepo), npm som pakethanterare.

## Struktur

- **`src/app/`** – routes. `logga-in/`, `registrera/`, `api/auth/` (better-auth), `api/uploadthing/`, `api/export/` (CSV med fakturor och kunder), `api/cron/stada-uppladdningar` (Vercel Cron), och det skyddade området `mina-sidor/` (jobb, offerter, kunder, fakturor, statistik, företag, inställningar, `mer` = "Mer" i mobilmenyn, `jobb/[id]/skriv-ut` = fakturan för ett jobb, `fakturor/[id]/skriv-ut` = en sparad faktura eller kreditfaktura, `offerter/[id]/skriv-ut` = offert). Sidor som slutar på `/skriv-ut` visas utan meny.
- **`src/components/minasidor/`** – UI med affärslogik. `sida.tsx` (`Sida`, `SidHuvud`, `TillbakaLank`, `InfoRuta`) ger alla sidor samma upplägg – använd den på nya sidor. `nav-items.ts` är menyns sidor (`iMobilmeny` = egen knapp i bottenmenyn, högst fem). `bild-visare.tsx` visar en bild förstorad. uppdelat på `jobb/`, `offert/`, `kunder/`, `faktura/`, `foretag/`, `oversikt/`, `statistik/`, `installningar/`. Delat mellan jobb- och offertformuläret: `formular.tsx` (kort, fält, `ToggleRow`, `SumRow`), `kund-valjare.tsx` och `prisrader.tsx` (artiklar och övriga kostnader – kräver `<FormProvider>`).
- **`src/components/ui/`** – shadcn/ui. Lägg till nya komponenter med `npx shadcn add <komponent>`, skriv dem inte för hand.
- **`src/lib/`**
  - `job-schema.ts` – zod-scheman (kund, jobb, offert, företag), typer och **alla beräkningar** (`beräknaSummering`, `beräknaFaktura`, `offertPrisunderlag`, `radBelopp`, `avrundaTillOre`).
  - `faktura.ts` – `FakturaData` (allt som står på en faktura, färdigräknat), `skapaFakturaData`, `skapaKreditfaktura` och `fakturaFel` (det som stoppar att en faktura utfärdas). Samma data används för förhandsgranskning och sparad faktura.
  - `offert.ts` – `OffertData` och `skapaOffertData`, samma idé som fakturan men byggs om varje gång (ingen ögonblicksbild).
  - `job-actions.ts` – server actions (`"use server"`) för jobb, kunder, företag, konto, faktura (`utfardaFaktura`, `krediteraFaktura`) och bilder. Bara skrivningar, plus `laddaFlerJobb` ("Ladda fler" i jobblistan).
  - `anropa-action.ts` – `anropaAction`, som klienten alltid anropar server actions genom (fångar nätverksfel så att formuläret inte töms).
  - `jobb-filter.ts` – statusfiltren i jobblistan (delas av server och klient; filtrering, sök och räkning sker i databasen).
  - `offert-actions.ts` – server actions för offerter, inklusive `skapaJobbFranOffert` ("Gör om till jobb").
  - `jobb-db.ts` – hur ett validerat jobb sparas (`nyttJobbTillDb` m.fl.). Delas av `createJob` och `skapaJobbFranOffert` så att ett jobb alltid sparas med samma fält.
  - `queries.ts` – läsningar för serverkomponenter (`import "server-only"`, inga endpoints). `GALLANDE_FAKTURA` är villkoret för ett jobbs gällande faktura.
  - `statistik.ts` – läsningarna till statistiksidan (`getStatistik`, `tolkaPeriod`). Summerar per månad i databasen med `$queryRaw`. `räknaStatistik` tar databasen som argument, så den kan provköras i en transaktion som rullas tillbaka.
  - `server-hjalp.ts` – `getSession` och `inloggatForetag` (med `cache()`, en gång per förfrågan – använd dem i sidor i stället för `auth.api.getSession`), `requireCompany`/`requireExistingCompany`/`requireSession`, `idSchema` och `medFelhantering`. Delas av actions och läsningar.
  - `auth.ts` / `auth-client.ts` – better-auth. `env.ts` – kräver alla miljövariabler vid start.
  - `prisma.ts` – Prisma-klient med `@prisma/adapter-pg`.
  - `uploadthing.ts` / `uploadthing-client.ts` – filrouter (`jobbBilder`, `companyLogo`) och klient. Varje uppladdning registreras i tabellen `uppladdning` med företagets id.
- **`src/proxy.ts`** – Next 16:s ersättare för middleware. Måste ligga i `src/`. Kollar bara att sessionscookien finns – den riktiga behörighetskontrollen görs alltid på servern.
- **`prisma/schema.prisma`** – auth-tabeller (User/Session/Account/Verification) + Company, Customer, Job, jobbets underrader (Article, Trip, WorkSession, JobImage, OvrigKostnad), Faktura (sparade fakturor och kreditfakturor), Uppladdning (registrerade filer) och Offert med egna rader (OffertArtikel, OffertKostnad).
- **`vercel.json`** – funktionsregion (`lhr1`, nära Neon i London) och cron för städning av uppladdningar.
- **`next.config.ts`** – säkerhetsheaders (CSP m.fl.) och bildadresser. Bara den egna UploadThing-appen (`<app-id>.ufs.sh`, läses ur `UPLOADTHING_TOKEN`) är tillåten.

## Domänregler (påverkar pengar och säkerhet)

- **Ett konto, för alltid.** `databaseHooks.user.create.before` i `lib/auth.ts` stoppar fler än ett konto. Ta aldrig bort eller kringgå den spärren.
- **Ett företag per användare** (`Company.ownerId` är unikt), skapas av `requireCompany` vid första skrivningen. All affärsdata hänger på `companyId`.
- **Alla belopp räknas i `lib/job-schema.ts`:** `beräknaSummering` (delsummor) och `beräknaFaktura` (fakturarader, moms, ROT på arbetskostnad inkl. moms, öresutjämning, att betala). Satserna står i `MOMS_PROCENT` och `ROT_PROCENT` – skriv aldrig "25 %" eller "30 %" för hand i en vy. PDF (`faktura-pdf.tsx`) och utskriftsvy (`skriv-ut-klient.tsx`) ritar bara upp `FakturaData` – räkna aldrig belopp i en komponent och duplicera aldrig formeln. Ett radbelopp är `radBelopp(pris, antal)`, aldrig `pris * antal`.
- **Avrundning:** belopp avrundas till ören där de räknas fram (`avrundaTillOre`), så att raderna summerar exakt. Att betala avrundas till hela kronor, och skillnaden står som "Öresutjämning". I databasen lagras belopp fortfarande som `Float` – utom i `faktura`, där summorna är heltal i ören.
- **Fast pris** (`fastPris`) ersätter löpande räkning i exkl. moms. Tappa aldrig bort fältet när ett jobb redigeras – inte heller `fastPrisArbete`.
- **ROT** räknas bara på arbete som står på fakturan: löpande arbetstid, eller med fast pris `fastPrisArbete` (krävs då, `refine` i `jobSchema`). ROT gäller bara privatpersoner – `createJob`/`updateJob` stoppar ROT för företagskund.
- **Status:** ett jobb kan inte vara `betalt` utan att vara `fakturerat` (`refine` i `jobSchema`).
- **Fakturanummer:**
  - delas ut av `utfardaFaktura` (knappen "Utfärda faktura" på fakturasidan) i en transaktion med `FOR UPDATE`-lås, som också sätter `fakturerat`. Ett jobb som redan har ett nummer behåller det.
  - Fakturasidan visar en förhandsgranskning utan nummer tills fakturan utfärdas. Att öppna sidan får aldrig dela ut ett nummer.
  - `nastaFakturanummer` får aldrig sättas till ett nummer som redan är utfärdat (kontrolleras i `updateCompanySettings`, mot både jobb och sparade fakturor).
  - Ändra aldrig utdelningen till "läs, räkna +1, skriv" i separata steg.
  - Databasen har unikt index på `[companyId, fakturanummer]`, både på `job` och `faktura`.
- **Utfärdad faktura ändras aldrig** (bokföringslagen). Blir den fel krediteras den (`krediteraFaktura`): en kreditfaktura med eget nummer, negativa belopp och `krediterarId` till originalet. Jobbet blir då ofakturerat och kan faktureras på nytt. Ett jobb kan ha flera fakturor men högst en gällande (`GALLANDE_FAKTURA`). Har jobbet en gällande faktura sparar `updateJob` alltid `fakturerat: true`.
- **Innan en faktura utfärdas** kontrollerar `fakturaFel` (på servern och i förhandsgranskningen): kund, mer än 0 kr, säljarens momsreg.nr (räknas aldrig fram), beskrivning vid fast pris, ROT-uppgifter (giltigt personnummer + fastighetsbeteckning eller BRF:ens org.nr och lägenhetsnummer) och kundens momsreg.nr vid omvänd byggmoms.
- **Omvänd byggmoms** (`Customer.omvandByggmoms`): moms 0 och inget ROT i `beräknaFaktura` (`omvandMoms` i `Prisunderlag`). Räkna alltid ett jobb med `beräknaFaktura(jobbPrisunderlag(job))` så att kundens momsregel följer med.
- **Personnummer på fakturan** visas och sparas bara när ROT gäller.
- **Ett fakturerat jobb kan inte tas bort** (`deleteJob`), inte heller ett med fakturanummer eller sparade fakturor. `utfardaFaktura` sparar fakturan som en ögonblicksbild (`faktura.innehall` = `FakturaData`, med fakturadatum och summor i ören) i samma transaktion som numret delas ut. Utskrift och PDF läser sedan bara den sparade – ändringar i jobb, kund, företag eller satser påverkar den inte. Bara logotypen hämtas från företaget. Tas jobbet bort finns fakturan kvar (`onDelete: SetNull`). Ändra inte formen på `FakturaData` för gamla fakturor – lägg bara till fält.
- **Fakturadatum** är dagens datum i Sverige (`idagISverige()` i `lib/datum.ts`) – servern går i UTC.
- **Offerter** är en egen modell, skild från jobb och fakturor:
  - Egen nummerserie (`Company.nastaOffertnummer`), delas ut atomärt när offerten skapas. Rör aldrig fakturanumren. Testdatans offerter har nummer från 9001 och tar inget ur serien.
  - Beloppen räknas med `beräknaFaktura(offertPrisunderlag(offert))` – samma formel som fakturan, ingen egen. Beräknad arbetstid och körsträcka blir varsin rad.
  - En offert kan ändras fritt (inget bokföringsunderlag). Raderna byts ut i sin helhet när den sparas; `ordning` håller ordningen.
  - "Gör om till jobb" (`skapaJobbFranOffert`) låser offerten med `FOR UPDATE`, så att två klick inte ger två jobb. Den beräknade tiden blir **inte** loggad tid på jobbet – bara en anteckning.
- **Server actions** (`"use server"`) ska alltid:
  1. kräva inloggning (`requireCompany` / `requireExistingCompany` / `requireSession`),
  2. validera indata med zod **på servern** – klientens validering räknas inte,
  3. kontrollera ägarskap (`companyId`) för varje id från klienten, även `customerId` och id:n på underrader (artiklar, resor, arbetspass, övriga kostnader),
  4. returnera `{ ok: false, error }` med ett svenskt felmeddelande i stället för att kasta, och fånga databasfel med `medFelhantering` (eller try/catch).
- **En läsning får aldrig skapa eller ändra något.** Läsningar ligger i `queries.ts` (och `statistik.ts`), inte i en `"use server"`-fil.
- **UploadThing:** radera filer från UploadThing först **efter** att databasen har sparats (se `updateJob`) – aldrig direkt vid klick. Radera bara nycklar som tillhör det här företaget. Radera aldrig "allt som inte används". Bild- och logotypnycklar från klienten godtas bara om de finns i `uppladdning` för företaget, och adressen tas därifrån (`egnaUppladdningar`). `deleteUploadedImage` raderar bara osparade uppladdningar.
- **Klienten** anropar server actions genom `anropaAction` – annars hamnar ett nätverksfel i felsidan och formuläret töms.
- **Decimaltal** skrivs i textfält med `decimalFalt` (`inputMode="decimal"`) och `tomtBlirNoll`/`tomtBlirInget`/`tomtBlirFel`, som tolkar både komma och punkt. Använd inte `type="number"` för decimaler.
- **Datum:** resor och arbetspass är `@db.Date` och skickas som `YYYY-MM-DD`. Standarddatum räknas i lokal tid (`idag()` i `lib/datum.ts`), inte med `toISOString()` (UTC).
- **Personnummer** visas bara där det behövs (ROT, faktura).
- **Statistik:** omsättning och ROT räknas bara på utfärdade fakturor (`faktura`, kreditfakturor drar av), efter fakturadatum och med de sparade summorna i ören – aldrig genom att räkna om jobben. Ett jobb som är markerat som fakturerat utan utfärdad faktura har inget fakturadatum och räknas inte i omsättningen (sidan säger hur många det är). Obetalt gäller just nu: sparat belopp att betala, annars `beräknaFaktura`. Tidpunkter (`skapad`) grupperas i svensk tid, datum (`@db.Date`) som de är.
- **Kundnamn** visas alltid med `kundensNamn()` från `lib/job-schema.ts` – aldrig `foretagsnamn || namn` direkt.
- **En kund med fakturerade jobb kan inte tas bort** (en förhandsgranskad faktura hämtar mottagaren från kunden – en utfärdad har den sparad).

### Testdata

`npm run testdata` lägger in påhittade kunder och jobb (id börjar på `testdata-`), `npm run testdata:ta-bort` tar bort dem. Ska tas bort innan appen används på riktigt.

**Ändras Prisma-schemat:** uppdatera `scripts/testdata.mjs` i samma ändring och kör `npm run testdata` för att se att skriptet fortfarande fungerar. Skriptet skriver kolumnerna direkt och går annars sönder.

### Kända brister (rätta inte i förbigående – gör ett kort)

Följande bryter mot reglerna ovan i dagens kod. Ny kod ska följa reglerna; fixa de gamla bristerna bara när uppgiften gäller dem.

- Inga tester, ingen Prettier och ingen CI.

## Dokumentation – gissa inte

Versionerna är nyare än det du lärt dig. Slå upp i dokumentationen innan du använder ett API du är osäker på, och **alltid** när det gäller auth, databas eller säkerhet. Läs bara den sida som behövs – ladda inte in hela filer.

| Bibliotek       | Version | Dokumentation                                         |
| --------------- | ------- | ----------------------------------------------------- |
| Next.js         | 16.2    | `node_modules/next/dist/docs/` (lokalt, rätt version) |
| React           | 19.2    | https://react.dev/llms.txt                            |
| better-auth     | 1.6     | https://better-auth.com/docs/1.6/llms.txt             |
| Prisma          | 7       | https://www.prisma.io/llms.txt                        |
| zod             | 4       | https://zod.dev/llms.txt                              |
| react-hook-form | 7       | https://react-hook-form.com/docs                      |
| shadcn/ui       | 4       | https://ui.shadcn.com/llms.txt                        |
| Tailwind CSS    | 4       | https://tailwindcss.com/docs                          |
| react-pdf       | 4       | https://react-pdf.org/llms.txt                        |
| UploadThing     | 7       | https://docs.uploadthing.com (ingen llms.txt)         |

## Kommandon

```bash
npm run dev              # port 3000
npx tsc --noEmit         # typkontroll (det finns inget eget skript)
npm run lint
npm run build            # prisma generate + next build

# Databas – använder DATABASE_URL i .env
npm run db:migrate       # prisma migrate dev – ny migrering
npx prisma migrate deploy
npx prisma studio
```

## Klart betyder

1. `npx tsc --noEmit` och `npm run lint` går igenom. Kör `npm run build` vid ändringar i routes, konfig, beroenden eller Prisma-schemat.
2. Ändringar i beräkningar (belopp, moms, ROT, fakturanummer) är kontrollräknade för hand med ett konkret exempel i sammanfattningen – tills det finns tester.
3. Ändringar i UI: säg tydligt vad du **inte** har kunnat testa (t.ex. inloggade sidor, PDF, uppladdning).
4. Kanban är uppdaterad (se nedan).
5. Du har skrivit ett commit-meddelande.
6. Du har avslutat med ett "Lär dig"-block (se nedan), om uppgiften var större än en småfix.

## Lärande

Användaren vill fräscha upp och fördjupa sina kunskaper medan hen bygger – inte bara få koden skriven. Avsluta därför varje **större** uppgift (ny funktion, buggfix med en lärdom, säkerhet, databas, arkitektur) med ett kort block, **efter** sammanfattning och commit-meddelande:

```
**Lär dig: <ämne>**
**Fakta:** en sak från koden du just skrev, med länk till filen/raden.
**Varför:** varför man gör så – och vad som händer om man inte gör det.
**Frågor:**
1. en fråga om just den här koden (förstå, förutsäga eller hitta i koden),
2. en fråga till – gärna en vanlig intervjufråga inom samma ämne.
```

- **Max ca 10 rader och 2 frågor.** Hoppa över för småfix (stavfel, formatering, kanban, konfig utan lärdom).
- **Utgå från det som just byggdes**, inte allmänna övningar. Rotera ämnen: TypeScript, Prisma/PostgreSQL, Next.js, säkerhet, arkitektur, testning, verktyg (git, npm, Vercel).
- **Avslöja inte svaren.** Vänta på användarens svar, rätta kort (rätt/delvis/fel + det viktigaste i 2–4 meningar). Säger hen "vet inte": ledtråd först.
- **Logga** varje block i `.claude/larande/logg.md` (privat, gitignore) och uppdatera status när användaren har svarat (`ny` → `rätt`/`delvis`/`fel` + datum). Frågor med `fel` tas upp igen i ett senare block.
- **Nivå:** användaren kan bygga projekt och förstår helheten, men har skrivit lite kod själv på sistone. Svarar hen lätt rätt – gå djupare (avvägningar, alternativ). Svarar hen fel – enklare och mer konkret.
- Användaren styr: "hoppa över" hoppar över ett block, "pausa lärandet" stänger av blocken tills hen säger till, "mer om det här" ger en fördjupning.

## Git

- **Committa och pusha aldrig.** Användaren committar själv.
- Avsluta med ett commit-meddelande på svenska: kort rubrik, tom rad, punktlista. Sist: `Co-Authored-By`-raden från systemet.
- Jobbet sker direkt på `main`. Appen körs på Vercel – en push till `main` kan gå ut i produktion.

## Databas

- PostgreSQL (t.ex. Neon), `DATABASE_URL` i `.env`. Schema i `prisma/schema.prisma`, migreringar i `prisma/migrations/`.
- **Utgå från att databasen innehåller riktiga kunder och fakturor.** Migreringar ska bevara data: döp om/kopiera i stället för att droppa, ta backup först och säg alltid till när en ändring kan radera eller ändra data.
- Utfärdade fakturanummer får aldrig ändras eller återanvändas.
- `prisma migrate reset` och `prisma db push --force-reset` kräver alltid uttryckligt godkännande från användaren i ett nytt meddelande.

## Kanban

GitHub Project 23 (`knixan`, "Skeninge VVS Loggen"), repo `knixan/skeningevvs-loggen`.

- Uppdatera korten när du blir klar med något: bocka av, flytta status, skapa nya kort för det som blir kvar.
- Sätt **Priority** (P0 = trasigt/fel belopp/säkerhet, P1 = bör göras snart, P2 = önskemål) och **Size** på nya kort.
- Skriv kortets body i en fil och använd `--body-file` (långa heredocs i bash går sönder).
- Flytta inte kort, skapa inte kort och stäng inte issues utan att användaren har bett om kanban-uppdatering eller att det ingår i uppgiften.

| Vad           | ID                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Projekt       | `PVT_kwHODHG13M4Bsg8d`                                                                                                 |
| Status-fält   | `PVTSSF_lAHODHG13M4Bsg8dzhquxFU` – Backlog `f75ad846`, Later `61e4505c`, In progress `47fc9ee4`, Done `98236657` |
| Priority-fält | `PVTSSF_lAHODHG13M4Bsg8dzhquxVA` – P0 `79628723`, P1 `0a877460`, P2 `da944a9c`                                         |
| Size-fält     | `PVTSSF_lAHODHG13M4Bsg8dzhquxVI` – XS `6c6483d2`, S `f784b110`, M `7515a9f1`, L `817d0097`, XL `db339eb2`             |

```bash
gh issue create -R knixan/skeningevvs-loggen --title "…" --body-file kort.md
gh project item-add 23 --owner knixan --url <issue-url> --format json --jq .id
gh project item-edit --project-id PVT_kwHODHG13M4Bsg8d --id <item-id> \
  --field-id PVTSSF_lAHODHG13M4Bsg8dzhquxFU --single-select-option-id f75ad846
```

Projektet lägger ibland till nya issues automatiskt. Ger `item-add` felet "Content already exists" – hämta item-id med `gh project item-list 23 --owner knixan --format json` och sätt fälten ändå.

När ett kort är klart: sätt status Done och kontrollera att issuen stängts – annars `gh issue close`.
