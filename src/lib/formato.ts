// Formateo determinista servidor↔cliente.
//
// El SSR corre en Vercel (UTC) y la hidratación en el navegador del usuario
// (America/Asuncion). Usar toLocaleString()/toLocaleDateString() sin fijar
// zona produce textos distintos entre servidor y cliente → React error #418
// (ver comentario histórico en pegasus-client.tsx). Estos helpers fijan
// locale "es-PY" y timeZone "America/Asuncion" SIEMPRE.

const TZ = "America/Asuncion";

/** Fecha corta: 25/8/2026 */
export function fechaCorta(fecha: string | Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeZone: TZ,
  }).format(new Date(fecha));
}

/** Fecha y hora cortas: 25/8/2026, 14:30 */
export function fechaHora(fecha: string | Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(fecha));
}

/** Número agrupado es-PY: 1234567 → "1.234.567" */
export function numero(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return String(v);
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 2 }).format(v);
}
