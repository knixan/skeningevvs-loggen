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

- **`src/app/`** – routes. `logga-in/`, `registrera/`, `api/auth/` (better-auth), `api/uploadthing/`, och det skyddade området `mina-sidor/` (jobb, kunder, företag, inställningar, `jobb/[id]/skriv-ut` = faktura).
- **`src/components/minasidor/`** – UI med affärslogik, uppdelat på `jobb/`, `kunder/`, `faktura/`, `foretag/`, `oversikt/`, `installningar/`.
- **`src/components/ui/`** – shadcn/ui. Lägg till nya komponenter med `npx shadcn add <komponent>`, skriv dem inte för hand.
- **`src/lib/`**
  - `job-schema.ts` – zod-scheman (kund, jobb, företag), typer och **alla beräkningar** (`beräknaSummering`, `beräknaFaktura`).
  - `job-actions.ts` – server actions (`"use server"`) för jobb, kunder, företag, konto, fakturanummer och bilder.
  - `auth.ts` / `auth-client.ts` – better-auth. `env.ts` – kräver alla miljövariabler vid start.
  - `prisma.ts` – Prisma-klient med `@prisma/adapter-pg`.
  - `uploadthing.ts` / `uploadthing-client.ts` – filrouter (`jobbBilder`, `companyLogo`) och klient.
- **`src/proxy.ts`** – Next 16:s ersättare för middleware. Måste ligga i `src/`. Kollar bara att sessionscookien finns – den riktiga behörighetskontrollen görs alltid på servern.
- **`prisma/schema.prisma`** – auth-tabeller (User/Session/Account/Verification) + Company, Customer, Job och jobbets underrader (Article, Trip, WorkSession, JobImage, OvrigKostnad).

## Domänregler (påverkar pengar och säkerhet)

- **Ett konto, för alltid.** `databaseHooks.user.create.before` i `lib/auth.ts` stoppar fler än ett konto. Ta aldrig bort eller kringgå den spärren.
- **Ett företag per användare** (`Company.ownerId` är unikt), skapas av `getOrCreateCompany`. All affärsdata hänger på `companyId`.
- **Alla belopp räknas i `lib/job-schema.ts`:** `beräknaSummering` (delsummor) och `beräknaFaktura` (moms 25 %, ROT 30 % på arbetskostnad inkl. moms, att betala). PDF (`faktura-pdf.tsx`) och utskriftsvy (`skriv-ut-klient.tsx`) ritar bara upp resultatet – räkna aldrig belopp i en komponent och duplicera aldrig formeln.
- **Fast pris** (`fastPris`) ersätter löpande räkning i exkl. moms. Tappa aldrig bort fältet när ett jobb redigeras.
- **Status:** ett jobb kan inte vara `betalt` utan att vara `fakturerat` (`refine` i `jobSchema`).
- **Fakturanummer:**
  - delas ut av `reserverFakturanummer` i en transaktion med `FOR UPDATE`-lås. Ett jobb som redan har ett nummer behåller det.
  - `nastaFakturanummer` får aldrig sättas till ett nummer som redan är utfärdat (kontrolleras i `updateCompanySettings`).
  - Ändra aldrig utdelningen till "läs, räkna +1, skriv" i separata steg.
- **Server actions** (`"use server"`) ska alltid:
  1. kräva inloggning (`requireCompany` / `requireExistingCompany` / `requireSession`),
  2. validera indata med zod **på servern** – klientens validering räknas inte,
  3. kontrollera ägarskap (`companyId`) för varje id från klienten, även `customerId` och id:n på underrader (artiklar, resor, arbetspass, övriga kostnader),
  4. returnera `{ ok: false, error }` med ett svenskt felmeddelande i stället för att kasta, och fånga databasfel med try/catch.
- **En läsning får aldrig skapa eller ändra något.**
- **UploadThing:** radera filer från UploadThing först **efter** att databasen har sparats (se `updateJob`) – aldrig direkt vid klick. Radera bara nycklar som tillhör det här företaget. Radera aldrig "allt som inte används".
- **Datum:** resor och arbetspass är `@db.Date` och skickas som `YYYY-MM-DD`. Standarddatum räknas i lokal tid (`idag()` i `lib/datum.ts`), inte med `toISOString()` (UTC).
- **Personnummer** visas bara där det behövs (ROT, faktura).

### Kända brister (rätta inte i förbigående – gör ett kort)

Följande bryter mot reglerna ovan i dagens kod. Ny kod ska följa reglerna; fixa de gamla bristerna bara när uppgiften gäller dem.

- `createJob`, `updateJob`, `createCustomer` och `updateCustomer` validerar inte med zod på servern (bara `updateCompanySettings` gör det).
- `updateJob` kontrollerar inte att id:n på underrader från klienten tillhör jobbet.
- Bild-`url`/`key` från klienten valideras inte mot vad som faktiskt laddats upp.
- Läsningar (`getJobs`, `getCustomers` m.fl.) ligger i `"use server"`-filen och blir därmed anropbara endpoints. `getCompanySettings` skapar företaget om det saknas.
- Fakturanummer reserveras redan när utskriftssidan öppnas, så ett jobb kan få nummer utan att faktureras.
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
