// Klientsidan av server actions.
//
// En action returnerar { ok: false, error } när något går fel på servern.
// Men når anropet aldrig servern (mobilen tappar täckningen i ett pannrum)
// eller svarar servern med ett fel, *kastas* ett fel i stället. Inne i
// startTransition hamnar det då i närmaste error boundary – sidan byts mot
// "Något gick fel" och allt som fyllts i formuläret försvinner.
//
// Använd därför alltid:
//
//   const result = await anropaAction(() => createJob(data, bilder));
//   if (!result.ok) toast.error(result.error);

export const NATVERKSFEL =
  "Kunde inte nå servern. Det du fyllt i finns kvar – kontrollera anslutningen och försök igen.";

export async function anropaAction<T>(
  fn: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (err) {
    console.error("Server action misslyckades:", err);
    return { ok: false, error: NATVERKSFEL };
  }
}
