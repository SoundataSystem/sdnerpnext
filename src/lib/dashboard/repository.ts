import "server-only";
import { prisma } from "@/lib/prisma";
import { getResumenVentas } from "@/lib/ventas/repository";
import { getResumenCompras } from "@/lib/compras/repository";
import { getResumenInventario } from "@/lib/inventario/repository";
import { getResumenCotizaciones } from "@/lib/cotizaciones/repository";
import { getResumenDevoluciones } from "@/lib/devoluciones/repository";
import { getResumenServicios } from "@/lib/servicios/repository";

export interface DashboardActividad {
  tipo:
    | "venta"
    | "compra"
    | "cotizacion"
    | "devolucion"
    | "orden_servicio"
    | "ticket"
    | "rma";
  titulo: string;
  detalle: string;
  monto: number;
  estado: string;
  fecha: Date;
  href: string;
}

export interface DashboardData {
  ventas: Awaited<ReturnType<typeof getResumenVentas>>;
  compras: Awaited<ReturnType<typeof getResumenCompras>>;
  inventario: Awaited<ReturnType<typeof getResumenInventario>>;
  cotizaciones: Awaited<ReturnType<typeof getResumenCotizaciones>>;
  devoluciones: Awaited<ReturnType<typeof getResumenDevoluciones>>;
  servicios: Awaited<ReturnType<typeof getResumenServicios>>;
  contabilidad: {
    asientos_contabilizados: number;
    total_cxc: number;
    total_cxp: number;
  };
  ventas_mes: number;
  compras_mes: number;
  actividad: DashboardActividad[];
}

// Valores por defecto para cada sección cuando la query falla
const VENTAS_DEFAULT: Awaited<ReturnType<typeof getResumenVentas>> = {
  total_clientes: 0,
  ordenes_pendientes: 0,
  ordenes_completadas: 0,
  ordenes_canceladas: 0,
  caja_movimientos: 0,
  total_cobrado_hoy: 0,
};
const COMPRAS_DEFAULT: Awaited<ReturnType<typeof getResumenCompras>> = {
  total_proveedores: 0,
  ocs_borrador: 0,
  ocs_pendientes: 0,
  ocs_ingresadas: 0,
  ocs_canceladas: 0,
  total_cp_pendiente: 0,
};
const INVENTARIO_DEFAULT: Awaited<ReturnType<typeof getResumenInventario>> = {
  total_productos: 0,
  productos_activos: 0,
  total_depositos: 0,
  bajo_minimo: 0,
  stock_total: 0,
  ajustes_pendientes: 0,
};
const COTIZACIONES_DEFAULT: Awaited<ReturnType<typeof getResumenCotizaciones>> =
  {
    total_cotizaciones: 0,
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
    monto_pendiente: 0,
    monto_aprobado: 0,
  };
const DEVOLUCIONES_DEFAULT: Awaited<ReturnType<typeof getResumenDevoluciones>> =
  {
    ventas_pendientes: 0,
    ventas_aprobadas: 0,
    ventas_rechazadas: 0,
    compras_pendientes: 0,
    compras_aprobadas: 0,
    monto_devuelto: 0,
  };
const SERVICIOS_DEFAULT: Awaited<ReturnType<typeof getResumenServicios>> = {
  ordenes_pendientes: 0,
  ordenes_en_progreso: 0,
  instalaciones_programadas: 0,
  garantias_validadas: 0,
  tickets_abiertos: 0,
  rmas_pendientes: 0,
  tecnicos_activos: 0,
};

/** Ejecuta una promesa y devuelve su resultado o el fallback si falla. */
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error("[dashboard] query fallida, usando fallback:", err);
    return fallback;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const inicioMes = new Date();
  inicioMes.setHours(0, 0, 0, 0);
  inicioMes.setDate(1);

  // Cada sección tiene su propio fallback: si una tabla falla el resto sigue.
  const [
    ventas,
    compras,
    inventario,
    cotizaciones,
    devoluciones,
    servicios,
    ventasMes,
    comprasMes,
    cxc,
    cxp,
    asientos,
    ordenes,
    ultCotizaciones,
    ots,
    tickets,
    rmas,
    ocs,
    ultDevoluciones,
  ] = await Promise.all([
    safe(getResumenVentas(), VENTAS_DEFAULT),
    safe(getResumenCompras(), COMPRAS_DEFAULT),
    safe(getResumenInventario(), INVENTARIO_DEFAULT),
    safe(getResumenCotizaciones(), COTIZACIONES_DEFAULT),
    safe(getResumenDevoluciones(), DEVOLUCIONES_DEFAULT),
    safe(getResumenServicios(), SERVICIOS_DEFAULT),
    safe(
      prisma.orden.aggregate({
        where: { estado: "completada", created_at: { gte: inicioMes } },
        _sum: { total: true },
      }),
      { _sum: { total: null } },
    ),
    safe(
      prisma.ordenesCompra.aggregate({
        where: { estado: "ingresada", created_at: { gte: inicioMes } },
        _sum: { total: true },
      }),
      { _sum: { total: null } },
    ),
    safe(
      prisma.cuentaCobrar.aggregate({
        where: { estado: { in: ["pendiente", "parcial"] } },
        _sum: { saldo_pendiente: true },
      }),
      { _sum: { saldo_pendiente: null } },
    ),
    safe(
      prisma.cuentaPagar.aggregate({
        where: { estado: { in: ["pendiente", "parcial"] } },
        _sum: { saldo_pendiente: true },
      }),
      { _sum: { saldo_pendiente: null } },
    ),
    safe(
      prisma.asientoContable.count({ where: { estado: "contabilizado" } }),
      0,
    ),
    safe(
      prisma.orden.findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          numero_orden: true,
          total: true,
          estado: true,
          created_at: true,
          cliente: { select: { nombre: true, apellido: true } },
        },
      }),
      [],
    ),
    safe(
      prisma.cotizacion.findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          numero_cotizacion: true,
          total: true,
          estado: true,
          created_at: true,
          cliente: { select: { nombre: true, apellido: true } },
        },
      }),
      [],
    ),
    safe(
      prisma.ordenServicio.findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          numero_orden: true,
          costo_total: true,
          estado: true,
          created_at: true,
          cliente_nombre: true,
        },
      }),
      [],
    ),
    safe(
      prisma.ticketSoporte.findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          numero_ticket: true,
          asunto: true,
          estado: true,
          created_at: true,
        },
      }),
      [],
    ),
    safe(
      prisma.rma.findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          numero_rma: true,
          motivo: true,
          estado: true,
          created_at: true,
          monto_reembolso: true,
        },
      }),
      [],
    ),
    safe(
      prisma.ordenesCompra.findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          numero_orden: true,
          total: true,
          estado: true,
          created_at: true,
          proveedor: { select: { supplier: true } },
        },
      }),
      [],
    ),
    safe(
      prisma.devolucionVenta.findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          numero_devolucion: true,
          subtotal: true,
          estado: true,
          created_at: true,
          orden: { select: { numero_orden: true } },
        },
      }),
      [],
    ),
  ]);

  const nombreCliente = (c: {
    nombre: string;
    apellido: string;
  } | null) => (c ? `${c.nombre} ${c.apellido}`.trim() : "Cliente");

  const actividad: DashboardActividad[] = [
    ...ordenes.map((o) => ({
      tipo: "venta" as const,
      titulo: o.numero_orden,
      detalle: nombreCliente(o.cliente),
      monto: Number(o.total ?? 0),
      estado: o.estado,
      fecha: o.created_at,
      href: `/ventas/ordenes/${o.id}`,
    })),
    ...ultCotizaciones.map((c) => ({
      tipo: "cotizacion" as const,
      titulo: c.numero_cotizacion ?? "Cotización",
      detalle: nombreCliente(c.cliente),
      monto: Number(c.total ?? 0),
      estado: c.estado ?? "pendiente",
      fecha: c.created_at,
      href: `/cotizaciones/${c.id}`,
    })),
    ...ots.map((o) => ({
      tipo: "orden_servicio" as const,
      titulo: o.numero_orden,
      detalle: o.cliente_nombre ?? "Orden de servicio",
      monto: Number(o.costo_total ?? 0),
      estado: o.estado,
      fecha: o.created_at ?? new Date(),
      href: "/servicios/ordenes",
    })),
    ...tickets.map((t) => ({
      tipo: "ticket" as const,
      titulo: t.numero_ticket ?? "Ticket",
      detalle: t.asunto ?? "Soporte",
      monto: 0,
      estado: t.estado,
      fecha: t.created_at,
      href: "/servicios/tickets",
    })),
    ...rmas.map((r) => ({
      tipo: "rma" as const,
      titulo: r.numero_rma,
      detalle: r.motivo,
      monto: Number(r.monto_reembolso ?? 0),
      estado: r.estado,
      fecha: r.created_at,
      href: "/servicios/rmas",
    })),
    ...ocs.map((o) => ({
      tipo: "compra" as const,
      titulo: o.numero_orden ?? "Orden de compra",
      detalle: o.proveedor?.supplier ?? "Proveedor",
      monto: Number(o.total ?? 0),
      estado: o.estado,
      fecha: o.created_at,
      href: `/compras/ordenes/${o.id}`,
    })),
    ...ultDevoluciones.map((d) => ({
      tipo: "devolucion" as const,
      titulo: d.numero_devolucion ?? "Devolución",
      detalle: d.orden?.numero_orden ?? "Devolución de venta",
      monto: Number(d.subtotal ?? 0),
      estado: d.estado,
      fecha: d.created_at,
      href: `/devoluciones/ventas/${d.id}`,
    })),
  ]
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .slice(0, 12);

  return {
    ventas,
    compras,
    inventario,
    cotizaciones,
    devoluciones,
    servicios,
    contabilidad: {
      asientos_contabilizados: asientos,
      total_cxc: Number(cxc._sum.saldo_pendiente ?? 0),
      total_cxp: Number(cxp._sum.saldo_pendiente ?? 0),
    },
    ventas_mes: Number(ventasMes._sum.total ?? 0),
    compras_mes: Number(comprasMes._sum.total ?? 0),
    actividad,
  };
}
