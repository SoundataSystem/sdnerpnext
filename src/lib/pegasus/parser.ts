// Parser CSV de Pegasus — funciones puras y testeables.

export interface FilaCSV {
  fila: number;
  datos: Record<string, string>;
}

export function normalizarEncabezado(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (c) =>
      ({ á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n" })[c] ?? c,
    )
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Normaliza un nombre de columna para matching "fuzzy" (misma lógica que PROD QA:
 * sin acentos, sin puntuación, en minúsculas y sin espacios).
 */
export function normalizarColumna(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parseCSV(texto: string): string[][] {
  const filas = texto.split(/\r?\n/);
  return filas
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .map((f) => f.split(";").map((c) => c.trim()));
}

export function filasAObjetos(texto: string, filaEncabezado = 0): FilaCSV[] {
  const filas = parseCSV(texto);
  if (filas.length === 0) return [];
  const h = Math.min(Math.max(filaEncabezado, 0), filas.length - 1);
  const headers = filas[h].map(normalizarEncabezado);
  return filas
    .slice(h + 1)
    .map((celdas, i) => {
      const datos: Record<string, string> = {};
      headers.forEach((head, j) => {
        if (head) datos[head] = celdas[j] ?? "";
      });
      return { fila: i + h + 2, datos };
    })
    .filter((f) => Object.values(f.datos).some((v) => v !== ""))
    .filter((f) => !esFilaResumen(f.datos));
}

/**
 * Detecta filas de resumen que Pegasus agrega al pie de los exports
 * (p.ej. "Total de Clientes:", "Líneas", "Categoría : Todos", "Estado:"),
 * para no tratarlas como filas de datos. Reconoce la etiqueta en cualquier
 * columna y se limita a filas con 1-2 celdas pobladas (las reales tienen más).
 */
export function esFilaResumen(datos: Record<string, string>): boolean {
  const pobladas = Object.values(datos).filter((v) => v.trim() !== "");
  if (pobladas.length === 0 || pobladas.length > 2) return false;
  // Matching por prefijo: cubre variantes como "Fecha Alta >= a" → "fechaaltaa".
  return pobladas.some((c) =>
    [...RESUMEN_PEGASUS.keys()].some(
      (clave) => normalizarColumna(c).startsWith(clave),
    ),
  );
}

const RESUMEN_PEGASUS = new Set([
  "totaldeclientes",
  "totaldefilas",
  "totalclientes",
  "lineas",
  "categoria",
  "estado",
  "vendedor",
  "zona",
  "tipocliente",
  "ciudad",
  "fechaalta",
  "fechadesde",
  "fechahasta",
  "usuario",
  // Bloque de resumen del export de stock (filtros del reporte).
  "filtros",
  "filtrosestablecidos",
  "producto",
  "seccion",
  "subseccion",
  "grupo",
  "subcategoria",
  "marca",
  "depositos",
  "fecha",
  "pais",
  "iva",
  "proveedor",
]);

/**
 * Detecta la fila de encabezados real dentro de un set de filas crudas, buscando
 * la fila (dentro de las primeras `maxFilas`) que más celdas normalizadas coincidan
 * con las claves esperadas. Rechaza líneas de título (p.ej. "soundata_s_a" o la fecha)
 * y filas vacías. Devuelve -1 si ninguna fila tiene claves conocidas.
 */
export function detectarCabecera(filas: string[][], claves: Set<string>, maxFilas = 300): number {
  let mejor = -1;
  let mejorPuntaje = 0;
  const limite = Math.min(filas.length, maxFilas);
  for (let i = 0; i < limite; i++) {
    let puntaje = 0;
    for (const celda of filas[i]) {
      const n = normalizarEncabezado(celda);
      if (n && claves.has(n)) puntaje++;
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = i;
    }
  }
  return mejorPuntaje >= 1 ? mejor : -1;
}

/** Devuelve el primer valor presente entre varias claves, con matching fuzzy. */
export function valorDe(
  datos: Record<string, string>,
  claves: string[],
): string | null {
  const normalizadas = new Map<string, string>();
  for (const [k, v] of Object.entries(datos)) {
    const n = normalizarColumna(k);
    if (v && !normalizadas.has(n)) normalizadas.set(n, v);
  }
  for (const k of claves) {
    const v = normalizadas.get(normalizarColumna(k));
    if (v) return v;
  }
  return null;
}

export function num(v: string | null | undefined): number | null {
  if (!v) return null;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
