# Skeningevvs-loggen

Personlig jobb-, kund- och fakturaloggbok för en ensam VVS-firma. Byggd för en enda användare — ingen multi-tenant, inget team, ingen prenumeration.

## Funktioner

- **Jobb**: registrera artiklar, övriga kostnader, resor, arbetstid, bilder, fast pris eller löpande pris, status (ej påbörjat / pågående / utfört), fakturerings- och betalningsstatus
- **Kunder**: privatpersoner och företag, med ROT-uppgifter (fastighetsbeteckning, lägenhetsnummer, brf)
- **Fakturor**: skriv ut eller ladda ner som PDF, med löpande fakturanummer, ROT-avdrag, F-skatt och betalningsuppgifter (bankgiro/plusgiro/swish) — inget e-postutskick
- **Företagsuppgifter**: logotyp, kontaktuppgifter, fakturainställningar
- **Bilduppladdning** för jobbfoton och logotyp via UploadThing
- **Inloggning**: e-post + lösenord, ingen e-postverifiering. Endast ett konto kan registreras.

## Teknikstack

- [Next.js 16](https://nextjs.org/docs) (App Router, Turbopack) + React 19
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Prisma](https://www.prisma.io/) + PostgreSQL (t.ex. [Neon](https://neon.tech/))
- [better-auth](https://www.better-auth.com/) för autentisering
- [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) för formulär och validering
- [@react-pdf/renderer](https://react-pdf.org/) för fakturagenerering
- [UploadThing](https://uploadthing.com/) för filuppladdning

## Kom igång

### 1. Miljövariabler

Kopiera `.env.example` till `.env` och fyll i:

```bash
DATABASE_URL=       # Postgres-anslutning (t.ex. Neon)
BETTER_AUTH_SECRET=  # slumpad hemlig nyckel, minst 32 tecken (openssl rand -base64 32)
BETTER_AUTH_URL=     # https://din-domän, eller http://localhost:3000 lokalt
UPLOADTHING_TOKEN=   # från https://uploadthing.com/dashboard
```

### 2. Installera och migrera databasen

```bash
npm install
npm run db:migrate
```

### 3. Starta dev-servern

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000), gå till `/registrera` och skapa ditt (enda) konto.

## Skript

| Kommando             | Beskrivning                                |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Startar dev-servern (Turbopack)            |
| `npm run build`      | Genererar Prisma-klienten och bygger appen |
| `npm run start`      | Startar den byggda appen                   |
| `npm run lint`       | Kör ESLint                                 |
| `npm run db:migrate` | Kör Prisma-migreringar mot databasen       |

## Struktur

```
src/
├── app/
│   ├── logga-in/, registrera/     # Inloggning och registrering
│   ├── api/auth/, api/uploadthing/ # better-auth- och UploadThing-handlers
│   └── mina-sidor/                 # Skyddat område: jobb, kunder, företag, inställningar
├── components/
│   ├── ui/                         # shadcn/ui-komponenter
│   └── minasidor/                  # Affärslogik-UI (jobb, kunder, faktura, företag, översikt)
├── lib/                            # auth, prisma, job-actions, job-schema, uploadthing, env
└── proxy.ts                        # Route-skydd (måste ligga i src/, inte projektroten)
prisma/
└── schema.prisma                   # User/Session/Account (auth) + Company/Customer/Job (verksamhet)
```

## Driftsättning

Appen är byggd för att köras på Vercel med en extern Postgres-databas (t.ex. Neon). Sätt samma miljövariabler som ovan i projektets inställningar, med `BETTER_AUTH_URL` satt till produktionens `https://`-domän.
