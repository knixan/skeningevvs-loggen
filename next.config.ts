import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * UploadThing-appens id, ur UPLOADTHING_TOKEN (base64-kodad JSON med appId).
 * Bilderna ligger på https://<app-id>.ufs.sh. Byts UploadThing-appen följer
 * adressen med automatiskt.
 */
function uploadthingAppId(): string | null {
  const token = process.env.UPLOADTHING_TOKEN?.replace(/^['"]|['"]$/g, "");
  if (!token) return null;
  try {
    const { appId } = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    return typeof appId === "string" && /^[a-z0-9]+$/i.test(appId) ? appId : null;
  } catch {
    return null;
  }
}

const appId = uploadthingAppId();
if (!appId && !isDev) {
  throw new Error(
    "Kunde inte läsa UploadThing-appens id ur UPLOADTHING_TOKEN – bilderna skulle inte visas.",
  );
}
const bildvard = appId ? `${appId}.ufs.sh` : "*.ufs.sh";

// Content Security Policy utan nonce (se node_modules/next/dist/docs/01-app/
// 02-guides/content-security-policy.md). 'unsafe-inline' för skript krävs då
// av Next. 'wasm-unsafe-eval' behövs av PDF-biblioteket (layoutmotorn är
// WebAssembly). Bilder bara från den egna UploadThing-appen.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://${bildvard}`,
  "font-src 'self' data:",
  // Uppladdning till UploadThing och logotypen som PDF:en hämtar
  `connect-src 'self' https://*.uploadthing.com https://${bildvard}${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  images: {
    // Bara den egna appens bilder – annars kan vem som helst använda
    // bildoptimeringen (/_next/image) för andras bilder på vår Vercel-kvot.
    remotePatterns: [{ protocol: "https", hostname: bildvard }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Kameran behövs för att ta bilder direkt från mobilen
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
