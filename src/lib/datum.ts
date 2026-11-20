/** Dagens datum som `YYYY-MM-DD` i lokal tid (inte UTC som `toISOString()`). */
export function idag(): string {
  const nu = new Date();
  const ar = nu.getFullYear();
  const manad = String(nu.getMonth() + 1).padStart(2, "0");
  const dag = String(nu.getDate()).padStart(2, "0");
  return `${ar}-${manad}-${dag}`;
}

/** `YYYY-MM-DD` → t.ex. "25 nov". Tolkas som ett datum, utan tidszon. */
export function kortDatum(datum: string): string {
  const [ar, manad, dag] = datum.split("-").map(Number);
  return new Date(ar, manad - 1, dag).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });
}
