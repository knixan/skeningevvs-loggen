// CSV som Excel öppnar rätt: semikolon (svensk Excel), decimalkomma och BOM,
// så att å, ä och ö visas rätt.

function cell(v: string): string {
  // Celler som börjar med = + - @ tolkas som formler i Excel – skydda dem
  const sakert = /^[=+\-@\t\r]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(sakert) ? `"${sakert.replace(/"/g, '""')}"` : sakert;
}

/** Ören → "1234,50" */
export function oreTillText(ore: number): string {
  return (ore / 100).toFixed(2).replace(".", ",");
}

export function csvFil(filnamn: string, rubriker: string[], rader: string[][]) {
  const text =
    "﻿" +
    [rubriker, ...rader].map((rad) => rad.map(cell).join(";")).join("\r\n") +
    "\r\n";
  return new Response(text, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filnamn}"`,
      "Cache-Control": "no-store",
    },
  });
}
