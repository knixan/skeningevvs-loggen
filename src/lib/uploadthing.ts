import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { getOrCreateCompany } from "./server-hjalp";

const f = createUploadthing();

// Varje uppladdad fil registreras i tabellen `uppladdning` med företagets id.
// Server actions godtar sedan bara nycklar därifrån (en url eller nyckel som
// klienten hittat på avvisas), och bara osparade filer får raderas. Filer som
// aldrig sparas städas bort av /api/cron/stada-uppladdningar.

async function foretagFranRequest(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) throw new UploadThingError("Inte inloggad");
  // En uppladdning är en skrivning – företaget får skapas här
  const company = await getOrCreateCompany(session.user.id);
  return { companyId: company.id };
}

async function registrera(
  companyId: string,
  file: { key: string; ufsUrl: string },
  typ: "jobbild" | "logotyp",
) {
  await prisma.uppladdning.upsert({
    where: { key: file.key },
    create: { key: file.key, url: file.ufsUrl, companyId, typ },
    update: {},
  });
}

export const ourFileRouter = {
  jobbBilder: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .middleware(async ({ req }) => foretagFranRequest(req))
    .onUploadComplete(async ({ metadata, file }) => {
      await registrera(metadata.companyId, file, "jobbild");
      return { key: file.key };
    }),

  companyLogo: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => foretagFranRequest(req))
    .onUploadComplete(async ({ metadata, file }) => {
      await registrera(metadata.companyId, file, "logotyp");
      return { key: file.key };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
