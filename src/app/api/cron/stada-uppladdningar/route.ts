import { UTApi } from "uploadthing/server";
import { prisma } from "@/lib/prisma";

// Städar bort bilder som laddades upp men aldrig sparades på ett jobb eller
// som logotyp (fliken stängdes, man navigerade bort). Körs en gång per dygn
// av Vercel Cron (vercel.json).
//
// Raderar BARA nycklar som finns i tabellen `uppladdning`, inte är använda
// och är äldre än ett dygn – aldrig "allt som inte används" i UploadThing.
// En nyckel som ändå ligger på ett jobb eller som logotyp hoppas över.
//
// Vercel skickar `Authorization: Bearer <CRON_SECRET>` när miljövariabeln
// CRON_SECRET är satt. Utan den gör routen ingenting.

const ETT_DYGN_MS = 24 * 60 * 60 * 1000;
const PER_KORNING = 500;

export async function GET(request: Request) {
  const hemlighet = process.env.CRON_SECRET;
  if (!hemlighet) {
    return Response.json({ fel: "CRON_SECRET saknas" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${hemlighet}`) {
    return Response.json({ fel: "Obehörig" }, { status: 401 });
  }

  const gamla = await prisma.uppladdning.findMany({
    where: { anvand: false, skapad: { lt: new Date(Date.now() - ETT_DYGN_MS) } },
    select: { key: true },
    take: PER_KORNING,
  });
  if (gamla.length === 0) return Response.json({ raderade: 0 });

  // Dubbelkolla mot jobbilder och logotyper innan något raderas
  const keys = gamla.map((u) => u.key);
  const [jobbilder, logotyper] = await Promise.all([
    prisma.jobImage.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    }),
    prisma.company.findMany({
      where: { logoKey: { in: keys } },
      select: { logoKey: true },
    }),
  ]);
  const anvanda = new Set([
    ...jobbilder.map((b) => b.key),
    ...logotyper.map((c) => c.logoKey),
  ]);
  if (anvanda.size > 0) {
    await prisma.uppladdning.updateMany({
      where: { key: { in: [...anvanda] } },
      data: { anvand: true },
    });
  }

  const attRadera = keys.filter((k) => !anvanda.has(k));
  if (attRadera.length > 0) {
    await new UTApi().deleteFiles(attRadera);
    await prisma.uppladdning.deleteMany({
      where: { key: { in: attRadera }, anvand: false },
    });
  }

  return Response.json({ raderade: attRadera.length });
}
