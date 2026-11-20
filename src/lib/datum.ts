/** Dagens datum som `YYYY-MM-DD` i lokal tid (inte UTC som `toISOString()`). */
export function idag(): string {
  const nu = new Date();
  const ar = nu.getFullYear();
  const manad = String(nu.getMonth() + 1).padStart(2, "0");
  const dag = String(nu.getDate()).padStart(2, "0");
  return `${ar}-${manad}-${dag}`;
}

/**
 * Dagens datum i Sverige som `YYYY-MM-DD`. För servern, som går i UTC:
 * `idag()` skulle där ge gårdagens datum mellan midnatt och kl. 01/02.
 */
export function idagISverige(): string {
  const delar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const del = (typ: string) => delar.find((d) => d.type === typ)?.value;
  return `${del("year")}-${del("month")}-${del("day")}`;
}

/** `YYYY-MM-DD` + n dagar → `YYYY-MM-DD`. Räknar i UTC, så sommartid spelar ingen roll. */
export function laggTillDagar(datum: string, dagar: number): string {
  const [ar, manad, dag] = datum.split("-").map(Number);
  return new Date(Date.UTC(ar, manad - 1, dag + dagar))
    .toISOString()
    .slice(0, 10);
}

/** `YYYY-MM-DD` → t.ex. "25 nov". Tolkas som ett datum, utan tidszon. */
export function kortDatum(datum: string): string {
  const [ar, manad, dag] = datum.split("-").map(Number);
  return new Date(ar, manad - 1, dag).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });
}
