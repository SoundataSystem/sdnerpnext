import "server-only";
import { prisma } from "@/lib/prisma";
import {
  formatearNumero,
  getNextNumero,
  getProximoNumero,
} from "@/lib/numeracion";
import type {
  AsientoContable,
  AsientoContableDetalle,
  PlanCuenta,
} from "@/generated/prisma/client";
import {
  crearAsientoSchema,
  crearCuentaSchema,
  actualizarCuentaSchema,
  type CrearAsientoInput,
  type CrearCuentaInput,
  type ActualizarCuentaInput,
  type TipoCuenta,
} from "@/lib/contabilidad/schema";
import {
  bucketAntiguedad,
  diasVencido,
  type BucketAntiguedad,
} from "@/lib/contabilidad/calculos";
import {
  calcularNivelCuenta,
  validarCodigoJerarquico,
  cuentaEsDescendienteOIgual,
} from "@/lib/contabilidad/jerarquia";

// ────────────────────────────────────────────────────────────────────────────
// Tipos del dominio (DTOs serializables; sin Decimal de Prisma)
// ────────────────────────────────────────────────────────────────────────────

export interface CuentaDTO {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  nivel: number;
  padre_id: string | null;
  activo: boolean | null;
}

export interface DetalleDTO {
  id: string;
  asiento_id: string;
  cuenta_id: string;
  debe: number;
  haber: number;
  cuenta?: CuentaDTO | null;
}

export interface AsientoDTO {
  id: string;
  numero_asiento: string;
  fecha: string;
  concepto: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
  estado: "borrador" | "contabilizado" | "cancelado";
  created_at: string;
  updated_at: string;
  detalles: DetalleDTO[];
}

export interface MovimientoMayorDTO {
  id: string;
  asiento_id: string;
  cuenta_id: string;
  debe: number;
  haber: number;
  fecha: string;
  numero_asiento: string;
  concepto: string;
  cuenta: CuentaDTO | null;
}

export interface SaldoCuentaDTO {
  cuenta: CuentaDTO;
  total_debe: number;
  total_haber: number;
  saldo: number;
}

export interface CuentaCobrarDTO {
  id: string;
  orden_id: string | null;
  orden_numero: string | null;
  cliente_nombre: string;
  cliente_cedula: string | null;
  monto_total: number;
  pagado: number;
  saldo_pendiente: number;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  estado: string;
  dias_vencido: number;
  bucket: BucketAntiguedad;
}

export interface CuentaPagarDTO {
  id: string;
  orden_compra_id: string | null;
  oc_numero: string | null;
  proveedor_nombre: string;
  monto_total: number;
  pagado: number;
  saldo_pendiente: number;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  estado: string;
  dias_vencido: number;
  bucket: BucketAntiguedad;
}

export interface ResumenCuentasDTO {
  cxc_pendiente: number;
  cxc_vencido: number;
  cxp_pendiente: number;
  cxp_vencido: number;
  cxc_total: number;
  cxp_total: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers Prisma → DTO
// ────────────────────────────────────────────────────────────────────────────

function toCuenta(c: PlanCuenta): CuentaDTO {
  return {
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    tipo: c.tipo as TipoCuenta,
    nivel: c.nivel,
    padre_id: c.padre_id,
    activo: c.activo,
  };
}

function toAsiento(
  a: AsientoContable,
  detalles: (AsientoContableDetalle & {
    cuenta?: PlanCuenta | null;
  })[],
): AsientoDTO {
  return {
    id: a.id,
    numero_asiento: a.numero_asiento,
    fecha: a.fecha.toISOString().split("T")[0],
    concepto: a.concepto,
    referencia_tipo: a.referencia_tipo,
    referencia_id: a.referencia_id,
    estado: a.estado as AsientoDTO["estado"],
    created_at: a.created_at.toISOString(),
    updated_at: a.updated_at.toISOString(),
    detalles: detalles.map((d) => ({
      id: d.id,
      asiento_id: d.asiento_id,
      cuenta_id: d.cuenta_id,
      debe: Number(d.debe ?? 0),
      haber: Number(d.haber ?? 0),
      cuenta: d.cuenta ? toCuenta(d.cuenta) : null,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Plan de Cuentas
// ────────────────────────────────────────────────────────────────────────────

export async function getCuentas(): Promise<CuentaDTO[]> {
  const rows = await prisma.planCuenta.findMany({
    orderBy: [{ codigo: "asc" }],
  });
  return rows.map(toCuenta);
}

function esErrorClaveUnica(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

export async function crearCuenta(data: CrearCuentaInput): Promise<CuentaDTO> {
  const parsed = crearCuentaSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    let padre: PlanCuenta | null = null;
    if (parsed.padre_id) {
      padre = await tx.planCuenta.findUnique({
        where: { id: parsed.padre_id },
      });
      if (!padre) throw new Error("La cuenta padre no existe");
      if (padre.activo === false) {
        throw new Error("La cuenta padre está inactiva");
      }
      const errorJerarquia = validarCodigoJerarquico(
        parsed.codigo,
        padre.codigo,
      );
      if (errorJerarquia) throw new Error(errorJerarquia);
    }

    // El nivel se deriva de la jerarquía: con padre → padre.nivel + 1;
    // sin padre → cantidad de segmentos del código (ej: 1, 1.1, 1.1.01).
    const nivel = calcularNivelCuenta(parsed.codigo, padre?.nivel ?? null);
    const tipo = parsed.tipo ?? "activo";

    try {
      const cuenta = await tx.planCuenta.create({
        data: {
          codigo: parsed.codigo,
          nombre: parsed.nombre,
          tipo,
          nivel,
          padre_id: parsed.padre_id ?? null,
          activo: parsed.activo ?? true,
        },
      });
      return toCuenta(cuenta);
    } catch (e) {
      if (esErrorClaveUnica(e)) {
        throw new Error(`Ya existe una cuenta con el código ${parsed.codigo}`);
      }
      throw e;
    }
  });
}

export async function actualizarCuenta(
  id: string,
  data: ActualizarCuentaInput,
): Promise<void> {
  const parsed = actualizarCuentaSchema.parse(data);

  await prisma.$transaction(async (tx) => {
    const cuenta = await tx.planCuenta.findUnique({ where: { id } });
    if (!cuenta) throw new Error("Cuenta no encontrada");

    const todas = await tx.planCuenta.findMany({
      select: { id: true, codigo: true, nivel: true, padre_id: true },
    });
    const mapaPadre = new Map(todas.map((c) => [c.id, c.padre_id]));

    const nuevoCodigo = parsed.codigo ?? cuenta.codigo;
    const nuevoPadreId =
      parsed.padre_id !== undefined ? parsed.padre_id : cuenta.padre_id;

    if (nuevoPadreId) {
      if (nuevoPadreId === id) {
        throw new Error("Una cuenta no puede ser su propio padre");
      }
      if (cuentaEsDescendienteOIgual(nuevoPadreId, id, mapaPadre)) {
        throw new Error(
          "No se puede asignar como padre una cuenta dependiente de esta",
        );
      }
      const padre = todas.find((c) => c.id === nuevoPadreId);
      if (!padre) throw new Error("La cuenta padre no existe");
      const errorJerarquia = validarCodigoJerarquico(nuevoCodigo, padre.codigo);
      if (errorJerarquia) throw new Error(errorJerarquia);
    }

    if (parsed.codigo !== undefined && parsed.codigo !== cuenta.codigo) {
      const tieneHijos = todas.some((c) => c.padre_id === id);
      if (tieneHijos) {
        throw new Error(
          "No se puede cambiar el código de una cuenta con sub-cuentas",
        );
      }
    }

    const padreNivel = nuevoPadreId
      ? (todas.find((c) => c.id === nuevoPadreId)?.nivel ?? null)
      : null;
    const nivel = calcularNivelCuenta(nuevoCodigo, padreNivel);

    try {
      await tx.planCuenta.update({
        where: { id },
        data: {
          ...(parsed.codigo !== undefined ? { codigo: parsed.codigo } : {}),
          ...(parsed.nombre !== undefined ? { nombre: parsed.nombre } : {}),
          ...(parsed.tipo !== undefined ? { tipo: parsed.tipo } : {}),
          nivel,
          ...(parsed.padre_id !== undefined
            ? { padre_id: parsed.padre_id }
            : {}),
          ...(parsed.activo !== undefined ? { activo: parsed.activo } : {}),
        },
      });
    } catch (e) {
      if (esErrorClaveUnica(e)) {
        throw new Error(`Ya existe una cuenta con el código ${parsed.codigo}`);
      }
      throw e;
    }
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Asientos Contables
// ────────────────────────────────────────────────────────────────────────────

export async function getAsientos(): Promise<AsientoDTO[]> {
  const rows = await prisma.asientoContable.findMany({
    include: {
      detalles: { include: { cuenta: true } },
    },
    orderBy: [{ fecha: "desc" }, { created_at: "desc" }],
  });
  return rows.map((r) =>
    toAsiento(r, r.detalles.map((d) => ({ ...d, cuenta: d.cuenta }))),
  );
}

export async function getAsiento(id: string): Promise<AsientoDTO | null> {
  const row = await prisma.asientoContable.findUnique({
    where: { id },
    include: {
      detalles: { include: { cuenta: true } },
    },
  });
  if (!row) return null;
  return toAsiento(row, row.detalles.map((d) => ({ ...d, cuenta: d.cuenta })));
}

type QueryExec = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
};

/**
 * Siguiente número de asiento ATÓMICO. Formato: AS-<año>-<secuencial 4 dígitos>.
 * Se serializa vía la tabla `numeradores` (upsert con lock de fila): dos creaciones
 * concurrentes nunca reciben el mismo secuencial. Debe llamarse dentro de la transacción
 * que inserta el asiento.
 */
export async function getNextAsientoNumber(
  caller: QueryExec = prisma,
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "AS",
    year,
    await getNextNumero(caller, "asiento", year),
  );
}

export async function getProximoAsientoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "AS",
    year,
    await getProximoNumero(prisma, "asiento", year),
  );
}

/**
 * Crea un asiento + detalles en una sola transacción (partida doble).
 * Valida en el servidor: líneas ≥ 2, montos positivos, cuenta activa,
 * debe == haber, y que el número de asiento no exista ya.
 */
export async function crearAsiento(input: CrearAsientoInput) {
  const parsed = crearAsientoSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    // Verificar que todas las cuentas existan y estén activas
    const cuentaIds = [...new Set(parsed.detalles.map((d) => d.cuenta_id))];
    const cuentas = await tx.planCuenta.findMany({
      where: { id: { in: cuentaIds } },
    });
    if (cuentas.length !== cuentaIds.length) {
      throw new Error("Una o más cuentas no existen");
    }
    const cuentaInactiva = cuentas.find((c) => c.activo === false);
    if (cuentaInactiva) {
      throw new Error(
        `La cuenta inactiva no puede usarse: ${cuentaInactiva.codigo} ${cuentaInactiva.nombre}`,
      );
    }

    // Re-validar partida doble (no confiar en el cliente)
    const totalDebe = parsed.detalles.reduce((s, d) => s + d.debe, 0);
    const totalHaber = parsed.detalles.reduce((s, d) => s + d.haber, 0);
    if (totalDebe !== totalHaber) {
      throw new Error(
        `El asiento no cuadra: Debe=₲${totalDebe.toLocaleString()} Haber=₲${totalHaber.toLocaleString()}`,
      );
    }

    // Número atómico dentro de la misma transacción
    const numero =
      parsed.asiento.numero_asiento || (await getNextAsientoNumber(tx));

    const asiento = await tx.asientoContable.create({
      data: {
        numero_asiento: numero,
        fecha: new Date(`${parsed.asiento.fecha}T00:00:00`),
        concepto: parsed.asiento.concepto,
        referencia_tipo: parsed.asiento.referencia_tipo ?? null,
        referencia_id: parsed.asiento.referencia_id ?? null,
        estado: parsed.asiento.estado,
      },
    });

    await tx.asientoContableDetalle.createMany({
      data: parsed.detalles.map((d) => ({
        asiento_id: asiento.id,
        cuenta_id: d.cuenta_id,
        debe: d.debe,
        haber: d.haber,
      })),
    });

    return asiento.id;
  });
}

/**
 * Contabiliza un asiento en borrador. Valida que exista, esté en borrador,
 * tenga al menos 2 líneas (en la práctica el trigger de partida doble lo
 * garantizó al insertar) y que el deber == haber antes de cambiar estado.
 */
export async function contabilizarAsiento(id: string): Promise<void> {
  return prisma.$transaction(async (tx) => {
    const asiento = await tx.asientoContable.findUnique({
      where: { id },
      select: {
        id: true,
        numero_asiento: true,
        estado: true,
        detalles: { select: { debe: true, haber: true } },
      },
    });
    if (!asiento) throw new Error("Asiento no encontrado");
    if (asiento.estado !== "borrador") {
      throw new Error(
        `Solo los asientos en borrador pueden contabilizarse (estado actual: ${asiento.estado})`,
      );
    }
    if (asiento.detalles.length < 2) {
      throw new Error("Un asiento debe tener al menos 2 líneas");
    }
    const totalDebe = asiento.detalles.reduce(
      (s, d) => s + Number(d.debe ?? 0),
      0,
    );
    const totalHaber = asiento.detalles.reduce(
      (s, d) => s + Number(d.haber ?? 0),
      0,
    );
    if (totalDebe !== totalHaber) {
      throw new Error(
        `El asiento no está balanceado: Debe=₲${totalDebe.toLocaleString()} Haber=₲${totalHaber.toLocaleString()}`,
      );
    }

    await tx.asientoContable.update({
      where: { id },
      data: { estado: "contabilizado" },
    });
  });
}

/**
 * Anula (cancela) un asiento. Requiere motivo — dato obligatorio que se
 * conserva en el `concepto` del asiento original (el esquema actual no
 * tiene columna de motivo de anulación).
 */
export async function anularAsiento(id: string, motivo: string): Promise<void> {
  if (!motivo?.trim()) {
    throw new Error("El motivo es obligatorio para anular un asiento");
  }

  return prisma.$transaction(async (tx) => {
    const asiento = await tx.asientoContable.findUnique({
      where: { id },
      select: { id: true, estado: true, concepto: true },
    });
    if (!asiento) throw new Error("Asiento no encontrado");
    if (asiento.estado === "cancelado") {
      throw new Error("El asiento ya está cancelado");
    }

    await tx.asientoContable.update({
      where: { id },
      data: {
        estado: "cancelado",
        concepto: `[ANULADO: ${motivo.trim()}] ${asiento.concepto}`,
      },
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Reportes
// ────────────────────────────────────────────────────────────────────────────

export async function getLibroMayor(
  cuentaId?: string,
  desde?: string,
  hasta?: string,
): Promise<MovimientoMayorDTO[]> {
  const contabilizados = await prisma.asientoContable.findMany({
    where: {
      estado: "contabilizado",
      ...(desde ? { fecha: { gte: new Date(`${desde}T00:00:00`) } } : {}),
      ...(hasta ? { fecha: { lte: new Date(`${hasta}T23:59:59`) } } : {}),
    },
    select: { id: true },
  });
  const asientoIds = contabilizados.map((a) => a.id);
  if (asientoIds.length === 0) return [];

  const detalles = await prisma.asientoContableDetalle.findMany({
    where: {
      asiento_id: { in: asientoIds },
      ...(cuentaId ? { cuenta_id: cuentaId } : {}),
    },
    include: {
      asiento: true,
      cuenta: true,
    },
    orderBy: [{ asiento: { fecha: "asc" } }],
  });

  return detalles.map((d) => ({
    id: d.id,
    asiento_id: d.asiento_id,
    cuenta_id: d.cuenta_id,
    debe: Number(d.debe ?? 0),
    haber: Number(d.haber ?? 0),
    fecha: d.asiento.fecha.toISOString().split("T")[0],
    numero_asiento: d.asiento.numero_asiento,
    concepto: d.asiento.concepto,
    cuenta: d.cuenta ? toCuenta(d.cuenta) : null,
  }));
}

export async function getBalanceComprobacion(
  desde?: string,
  hasta?: string,
): Promise<SaldoCuentaDTO[]> {
  const contabilizados = await prisma.asientoContable.findMany({
    where: {
      estado: "contabilizado",
      ...(desde ? { fecha: { gte: new Date(`${desde}T00:00:00`) } } : {}),
      ...(hasta ? { fecha: { lte: new Date(`${hasta}T23:59:59`) } } : {}),
    },
    select: { id: true },
  });
  const asientoIds = contabilizados.map((a) => a.id);
  if (asientoIds.length === 0) return [];

  const agrupado = await prisma.asientoContableDetalle.groupBy({
    by: ["cuenta_id"],
    where: { asiento_id: { in: asientoIds } },
    _sum: { debe: true, haber: true },
  });

  const cuentaIds = agrupado.map((g) => g.cuenta_id);
  const cuentas = await prisma.planCuenta.findMany({
    where: { id: { in: cuentaIds } },
  });
  const mapCuentas = new Map(cuentas.map((c) => [c.id, c]));

  return agrupado.map((g) => {
    const totalDebe = Number(g._sum.debe ?? 0);
    const totalHaber = Number(g._sum.haber ?? 0);
    const esDeudora =
      mapCuentas.get(g.cuenta_id)?.tipo === "activo" ||
      mapCuentas.get(g.cuenta_id)?.tipo === "gasto";
    return {
      cuenta: toCuenta(mapCuentas.get(g.cuenta_id)!),
      total_debe: totalDebe,
      total_haber: totalHaber,
      saldo: esDeudora ? totalDebe - totalHaber : totalHaber - totalDebe,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Cuentas por Cobrar / Pagar
// ────────────────────────────────────────────────────────────────────────────

export async function getCuentasCobrar(): Promise<CuentaCobrarDTO[]> {
  const rows = await prisma.cuentaCobrar.findMany({
    include: {
      cliente: {
        select: { id: true, nombre: true, apellido: true, cedula: true },
      },
      orden: { select: { numero_orden: true } },
    },
    orderBy: [{ fecha_vencimiento: { sort: "asc", nulls: "last" } }],
  });
  return rows.map((r) => {
    const fechaVenc = r.fecha_vencimiento
      ? r.fecha_vencimiento.toISOString().split("T")[0]
      : null;
    return {
      id: r.id,
      orden_id: r.orden_id,
      orden_numero: r.orden?.numero_orden ?? null,
      cliente_nombre: `${r.cliente.nombre} ${r.cliente.apellido}`.trim(),
      cliente_cedula: r.cliente.cedula,
      monto_total: Number(r.monto_total),
      pagado: Number(r.monto_total) - Number(r.saldo_pendiente),
      saldo_pendiente: Number(r.saldo_pendiente),
      fecha_emision: r.fecha_emision?.toISOString().split("T")[0] ?? null,
      fecha_vencimiento: fechaVenc,
      estado: r.estado,
      dias_vencido: Math.max(0, diasVencido(fechaVenc)),
      bucket: bucketAntiguedad(fechaVenc),
    };
  });
}

export async function getCuentasPagar(): Promise<CuentaPagarDTO[]> {
  const rows = await prisma.cuentaPagar.findMany({
    include: {
      proveedor: {
        select: { id: true, supplier: true, tax: true, phone: true },
      },
      ordenCompra: { select: { numero_orden: true } },
    },
    orderBy: [{ fecha_vencimiento: { sort: "asc", nulls: "last" } }],
  });
  return rows.map((r) => {
    const fechaVenc = r.fecha_vencimiento
      ? r.fecha_vencimiento.toISOString().split("T")[0]
      : null;
    return {
      id: r.id,
      orden_compra_id: r.orden_compra_id,
      oc_numero: r.ordenCompra?.numero_orden ?? null,
      proveedor_nombre: r.proveedor.supplier ?? "Proveedor",
      monto_total: Number(r.monto_total),
      pagado: Number(r.monto_total) - Number(r.saldo_pendiente),
      saldo_pendiente: Number(r.saldo_pendiente),
      fecha_emision: r.fecha_emision?.toISOString().split("T")[0] ?? null,
      fecha_vencimiento: fechaVenc,
      estado: r.estado,
      dias_vencido: Math.max(0, diasVencido(fechaVenc)),
      bucket: bucketAntiguedad(fechaVenc),
    };
  });
}

export async function getResumenCuentas(): Promise<ResumenCuentasDTO> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyISO = hoy.toISOString().split("T")[0];

  const [cxc, cxp, cxcVencido, cxpVencido] = await Promise.all([
    prisma.cuentaCobrar.aggregate({
      where: { estado: { in: ["pendiente", "parcial"] } },
      _sum: { saldo_pendiente: true },
      _count: { _all: true },
    }),
    prisma.cuentaPagar.aggregate({
      where: { estado: { in: ["pendiente", "parcial"] } },
      _sum: { saldo_pendiente: true },
      _count: { _all: true },
    }),
    prisma.cuentaCobrar.aggregate({
      where: {
        estado: { in: ["pendiente", "parcial"] },
        fecha_vencimiento: { lt: new Date(hoyISO) },
      },
      _sum: { saldo_pendiente: true },
    }),
    prisma.cuentaPagar.aggregate({
      where: {
        estado: { in: ["pendiente", "parcial"] },
        fecha_vencimiento: { lt: new Date(hoyISO) },
      },
      _sum: { saldo_pendiente: true },
    }),
  ]);

  return {
    cxc_pendiente: Number(cxc._sum.saldo_pendiente ?? 0),
    cxc_vencido: Number(cxcVencido._sum.saldo_pendiente ?? 0),
    cxp_pendiente: Number(cxp._sum.saldo_pendiente ?? 0),
    cxp_vencido: Number(cxpVencido._sum.saldo_pendiente ?? 0),
    cxc_total: cxc._count._all,
    cxp_total: cxp._count._all,
  };
}