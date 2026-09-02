import type { AsientoDTO, CuentaDTO } from "@/lib/contabilidad/repository";
import type { TipoCuenta } from "@/lib/contabilidad/schema";

// ────────────────────────────────────────────────────────────────────────────
// Utilidades de cálculo contable — puras y testeables
// (sin dependencias de React ni de la base de datos)
// ────────────────────────────────────────────────────────────────────────────

export interface FiltroFecha {
  desde?: string;
  hasta?: string;
}

export interface ResultadoCuenta {
  cuenta: CuentaDTO;
  total: number;
}

export interface ResultadoBalance {
  activos: ResultadoCuenta[];
  pasivos: ResultadoCuenta[];
  patrimonio: ResultadoCuenta[];
  totalActivos: number;
  totalPasivos: number;
  totalPatrimonio: number;
  cuadrado: boolean;
}

export interface ResultadoEstado {
  ingresos: ResultadoCuenta[];
  gastos: ResultadoCuenta[];
  totalIngresos: number;
  totalGastos: number;
  utilidad: number;
}

export interface MovimientoLibroDiario {
  fecha: string;
  numero_asiento: string;
  concepto: string;
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
}

// Filtra asientos por estado y por rango de fechas.
export function filtrarAsientos(
  asientos: AsientoDTO[],
  opts: { estado?: string } & FiltroFecha = {},
): AsientoDTO[] {
  return asientos.filter((a) => {
    if (opts.estado && a.estado !== opts.estado) return false;
    if (opts.desde && a.fecha < opts.desde) return false;
    if (opts.hasta && a.fecha > opts.hasta) return false;
    return true;
  });
}

// Toma todos los detalles de una lista de asientos.
export function aplanarDetalles(asientos: AsientoDTO[]) {
  return asientos.flatMap((a) => a.detalles ?? []);
}

// Saldo neto de una cuenta considerando su naturaleza:
// - Activo/Gasto: deudora (debe - haber)
// - Pasivo/Patrimonio/Ingreso: acreedora (haber - debe)
export function saldoCuenta(
  cuenta: Pick<CuentaDTO, "tipo">,
  detalles: { debe: number; haber: number }[],
): number {
  const esDeudora = cuenta.tipo === "activo" || cuenta.tipo === "gasto";
  return detalles.reduce(
    (s, d) =>
      s +
      (esDeudora
        ? (d.debe || 0) - (d.haber || 0)
        : (d.haber || 0) - (d.debe || 0)),
    0,
  );
}

function cuentasDeTipoYDetalle(
  tipo: TipoCuenta,
  cuentas: CuentaDTO[],
  detalles: { cuenta_id: string; debe: number; haber: number }[],
): ResultadoCuenta[] {
  return cuentas
    .filter((c) => c.tipo === tipo && c.nivel === 3)
    .map((c) => ({
      cuenta: c,
      total: saldoCuenta(
        c,
        detalles.filter((d) => d.cuenta_id === c.id),
      ),
    }))
    .filter((x) => x.total !== 0);
}

// Calcula totales por tipo de cuenta para el Balance General.
export function calcularBalance(
  asientos: AsientoDTO[],
  cuentas: CuentaDTO[],
  fechaCorte?: string,
): ResultadoBalance {
  const contabilizados = filtrarAsientos(asientos, {
    estado: "contabilizado",
    hasta: fechaCorte,
  });
  const todosDetalles = aplanarDetalles(contabilizados);

  const activos = cuentasDeTipoYDetalle("activo", cuentas, todosDetalles);
  const pasivos = cuentasDeTipoYDetalle("pasivo", cuentas, todosDetalles);
  const patrimonio = cuentasDeTipoYDetalle(
    "patrimonio",
    cuentas,
    todosDetalles,
  );

  const totalActivos = activos.reduce((s, a) => s + a.total, 0);
  const totalPasivos = pasivos.reduce((s, p) => s + p.total, 0);
  const totalPatrimonio = patrimonio.reduce((s, p) => s + p.total, 0);

  return {
    activos,
    pasivos,
    patrimonio,
    totalActivos,
    totalPasivos,
    totalPatrimonio,
    cuadrado: totalActivos === totalPasivos + totalPatrimonio,
  };
}

// Calcula totales de ingresos y gastos para el Estado de Resultados.
export function calcularEstadoResultados(
  asientos: AsientoDTO[],
  cuentas: CuentaDTO[],
  filtro: FiltroFecha = {},
): ResultadoEstado {
  const contabilizados = filtrarAsientos(asientos, {
    estado: "contabilizado",
    ...filtro,
  });
  const todosDetalles = aplanarDetalles(contabilizados);

  const ingresos = cuentasDeTipoYDetalle("ingreso", cuentas, todosDetalles);
  const gastos = cuentasDeTipoYDetalle("gasto", cuentas, todosDetalles);
  const totalIngresos = ingresos.reduce((s, i) => s + i.total, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.total, 0);
  return {
    ingresos,
    gastos,
    totalIngresos,
    totalGastos,
    utilidad: totalIngresos - totalGastos,
  };
}

// Construye movimientos de Libro Diario desde asientos (para UI y export).
export function construirMovimientosLibroDiario(
  asientos: AsientoDTO[],
  filtro: { cuentaId?: string } & FiltroFecha = {},
): MovimientoLibroDiario[] {
  return filtrarAsientos(asientos, { estado: "contabilizado", ...filtro })
    .flatMap((a) =>
      (a.detalles ?? []).map((d) => ({
        fecha: a.fecha,
        numero_asiento: a.numero_asiento,
        concepto: a.concepto,
        cuenta_id: d.cuenta_id,
        cuenta_codigo: d.cuenta?.codigo ?? "",
        cuenta_nombre: d.cuenta?.nombre ?? "",
        debe: d.debe || 0,
        haber: d.haber || 0,
      })),
    )
    .filter((m) => {
      if (filtro.cuentaId && m.cuenta_id !== filtro.cuentaId) return false;
      if (filtro.desde && m.fecha < filtro.desde) return false;
      if (filtro.hasta && m.fecha > filtro.hasta) return false;
      return true;
    });
}

// Formateadores (fuente única en @/lib/money).
export { formatGs as formatPyG, formatGsSigned as formatPyGSigned } from "@/lib/money";

// ────────────────────────────────────────────────────────────────────────────
// Antigüedad de saldos (cuentas por cobrar / pagar)
// ────────────────────────────────────────────────────────────────────────────

export type BucketAntiguedad =
  | "corriente"
  | "1-30"
  | "31-60"
  | "61-90"
  | "90+";

// Días de vencimiento. > 0 significa que la cuenta está vencida.
export function diasVencido(
  fechaVencimiento: string | Date | null,
  hoy?: Date,
): number {
  if (!fechaVencimiento) return 0;
  const aMedianoche = (v: string | Date): Date => {
    if (v instanceof Date) return new Date(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(v);
  };
  const h = hoy ? new Date(hoy) : new Date();
  h.setHours(0, 0, 0, 0);
  const f = aMedianoche(fechaVencimiento);
  return Math.round((h.getTime() - f.getTime()) / 86_400_000);
}

// Clasifica una cuenta según los días de atraso.
export function bucketAntiguedad(
  fechaVencimiento: string | Date | null,
  hoy?: Date,
): BucketAntiguedad {
  const d = diasVencido(fechaVencimiento, hoy);
  if (d <= 0) return "corriente";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

export const BUCKET_LABEL: Record<BucketAntiguedad, string> = {
  corriente: "Corriente",
  "1-30": "1-30 días",
  "31-60": "31-60 días",
  "61-90": "61-90 días",
  "90+": "Más de 90 días",
};