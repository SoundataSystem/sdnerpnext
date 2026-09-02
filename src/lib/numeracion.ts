export type CallerQueryRaw = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
};

export function claveNumerador(tipo: string, anio = new Date().getFullYear()): string {
  return `${tipo}:${anio}`;
}

export function formatearNumero(
  prefijo: string,
  anio: number,
  seq: number,
): string {
  return `${prefijo}-${anio}-${String(Math.max(1, seq)).padStart(4, "0")}`;
}

/**
 * Siguiente número ATÓMICO para un tipo de documento y año.
 *
 * Usa un upsert sobre `numeradores` (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`),
 * que toma un lock de fila y serializa los incrementos concurrentes: dos transacciones
 * simultáneas jamás reciben el mismo `ultimo`. Reemplaza el patrón `SELECT MAX()+1 ... FOR UPDATE`
 * (el `FOR UPDATE` sobre una agregación NO bloquea filas → dos `MAX+1` iguales → P2002 o colisión).
 *
 * Debe llamarse DENTRO de la misma transacción que inserta el documento: si esta revierte,
 * el incremento se revierte con ella (sin huecos).
 */
export async function getNextNumero(
  caller: CallerQueryRaw,
  tipo: string,
  anio = new Date().getFullYear(),
): Promise<number> {
  const key = claveNumerador(tipo, anio);
  const rows = await caller.$queryRaw<{ seq: number }[]>`
    INSERT INTO numeradores (tipo, ultimo, updated_at)
    VALUES (${key}, 1, now())
    ON CONFLICT (tipo) DO UPDATE SET ultimo = numeradores.ultimo + 1, updated_at = now()
    RETURNING ultimo AS seq
  `;
  return Number(rows[0]?.seq ?? 1);
}

/**
 * Estimación del próximo número SIN consumirlo (vista previa en la UI).
 * Lee `ultimo + 1` del contador; si el año aún no tiene contador devuelve 1
 * (equivale al inicio del año en la secuencia por año).
 */
export async function getProximoNumero(
  caller: CallerQueryRaw,
  tipo: string,
  anio = new Date().getFullYear(),
): Promise<number> {
  const key = claveNumerador(tipo, anio);
  const rows = await caller.$queryRaw<{ seq: number | null }[]>`
    SELECT COALESCE(MAX(ultimo), 0) + 1 AS seq
    FROM numeradores
    WHERE tipo = ${key}
  `;
  return Number(rows[0]?.seq ?? 1);
}
