import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  Cotizacion,
  CotizacionItem,
  Cliente,
  Producto,
  EstadoCotizacion,
} from "@/generated/prisma/client";
import {
  crearCotizacionSchema,
  cambiarEstadoCotizacionSchema,
  type CrearCotizacionInput,
} from "@/lib/cotizaciones/schema";
import {
  calcularSubtotal,
  calcularTotal,
} from "@/lib/cotizaciones/calculos";
import {
  formatearNumero,
  getNextNumero as siguienteNumero,
} from "@/lib/numeracion";

// ────────────────────────────────────────────────────────────────────────────
// Tipos del dominio (DTOs serializables)
// ────────────────────────────────────────────────────────────────────────────

export interface CotizacionItemDTO {
  item_id: string;
  producto_id: string;
  producto_codigo: string | null;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface CotizacionDTO {
  id: string;
  numero_cotizacion: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  is_tax_included: boolean | null;
  terms: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  estado: string;
  created_at: string;
  items: CotizacionItemDTO[];
}

export interface ResumenCotizacionesDTO {
  total_cotizaciones: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  monto_pendiente: number;
  monto_aprobado: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers
// ────────────────────────────────────────────────────────────────────────────

type CotizacionRaw = Cotizacion & {
  cliente?: Cliente | null;
  items?: (CotizacionItem & { producto?: Producto | null })[];
};

function toCotizacion(c: CotizacionRaw): CotizacionDTO {
  const nombreCliente =
    c.cliente?.nombre && c.cliente?.apellido
      ? `${c.cliente.nombre} ${c.cliente.apellido}`.trim()
      : c.cliente?.nombre ?? null;
  return {
    id: c.id,
    numero_cotizacion: c.numero_cotizacion ?? c.quotation_no ?? null,
    cliente_id: c.cliente_id ?? c.customer_id ?? null,
    cliente_nombre: nombreCliente,
    fecha_emision: (c.fecha_emision ?? c.quote_date)?.toISOString().split("T")[0] ?? null,
    fecha_vencimiento: (c.fecha_vencimiento ?? c.valid_until)?.toISOString().split("T")[0] ?? null,
    is_tax_included: c.is_tax_included,
    terms: c.terms ?? null,
    subtotal: Number(c.subtotal ?? 0),
    descuento: Number(c.descuento ?? 0),
    total: Number(c.total ?? 0),
    estado: (c.estado ?? "pendiente") as string,
    created_at: c.created_at.toISOString(),
    items: (c.items ?? [])
      .map((it) => ({
        item_id: it.item_id,
        producto_id: it.producto_id ?? it.producto?.id ?? "",
        producto_codigo: it.producto?.codigo ?? null,
        producto_nombre: it.producto?.nombre ?? "—",
        cantidad: Number(it.cantidad ?? it.quantity ?? 0),
        precio_unitario: Number(it.precio_unitario ?? it.unit_price ?? 0),
        subtotal: Number(
          it.subtotal ??
            Number(it.cantidad ?? it.quantity ?? 0) *
              Number(it.precio_unitario ?? it.unit_price ?? 0),
        ),
      }))
      .sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre)),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Consultas
// ────────────────────────────────────────────────────────────────────────────

export async function getCotizaciones(filtro?: {
  estado?: string;
  busqueda?: string;
}): Promise<CotizacionDTO[]> {
  const rows = await prisma.cotizacion.findMany({
    where:
      filtro?.estado && filtro.estado !== "todos"
        ? { estado: filtro.estado as EstadoCotizacion }
        : undefined,
    include: {
      cliente: true,
      items: { include: { producto: true } },
    },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });
  const mapped = rows.map(toCotizacion);
  if (filtro?.busqueda?.trim()) {
    const q = filtro.busqueda.toLowerCase();
    return mapped.filter(
      (c) =>
        c.numero_cotizacion?.toLowerCase().includes(q) ||
        c.cliente_nombre?.toLowerCase().includes(q),
    );
  }
  return mapped;
}

export async function getCotizacion(id: string): Promise<CotizacionDTO | null> {
  const row = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      items: { include: { producto: true } },
    },
  });
  return row ? toCotizacion(row) : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Nomenclatura v2 ↔ legacy (P2-3): mantiene los campos legacy (quotation_no,
// customer_id, quote_date, valid_until, quantity, unit_price) sincronizados
// con los v2 al escribir.
// ────────────────────────────────────────────────────────────────────────────

const campoNumeroCotizacion = (v: string) => ({
  numero_cotizacion: v,
  quotation_no: v,
});
const campoClienteCotizacion = (v: string) => ({ cliente_id: v, customer_id: v });
const campoFechaEmision = (v: Date) => ({ fecha_emision: v, quote_date: v });
const campoFechaVencimiento = (v: Date | null) => ({
  fecha_vencimiento: v,
  valid_until: v,
});
const campoLineaCotizacion = (it: {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}) => ({
  producto_id: it.producto_id,
  cantidad: it.cantidad,
  precio_unitario: it.precio_unitario,
  quantity: it.cantidad,
  unit_price: it.precio_unitario,
  subtotal: it.cantidad * it.precio_unitario,
  currency: "GS",
});

// ────────────────────────────────────────────────────────────────────────────
// Crear y cambiar estado
// ────────────────────────────────────────────────────────────────────────────

async function getNextNumero(
  caller: { $queryRaw<U>(q: TemplateStringsArray, ...v: unknown[]): Promise<U> },
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "CTZ",
    year,
    await siguienteNumero(caller, "cotizacion", year),
  );
}

export async function crearCotizacion(
  data: CrearCotizacionInput,
  usuario: { id: string; nombre: string },
): Promise<{ id: string; advertencias: string[] }> {
  const parsed = crearCotizacionSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({
      where: { id: parsed.cliente_id },
    });
    if (!cliente) throw new Error("Cliente no encontrado");

    const productoIds = [...new Set(parsed.items.map((i) => i.producto_id))];
    const productos = await tx.producto.findMany({
      where: { id: { in: productoIds } },
    });
    if (productos.length !== productoIds.length) {
      throw new Error("Uno o más productos no existen");
    }

    // Advertencia no bloqueante de stock disponible (P2-9): permite cotizar
    // sin stock (backorder) pero avisa al usuario en la UI.
    const stockPorProducto = new Map(
      productos.map((p) => [p.id, Number(p.stock_total ?? 0)]),
    );
    const advertencias = parsed.items
      .map((it) => {
        const disponible = stockPorProducto.get(it.producto_id) ?? 0;
        return disponible >= it.cantidad
          ? null
          : `Stock insuficiente para "${productos.find((p) => p.id === it.producto_id)?.nombre ?? it.producto_id}": disponible ${disponible}, cotizando ${it.cantidad}`;
      })
      .filter((w): w is string => Boolean(w));

    const subtotal = calcularSubtotal(parsed.items);
    const numero = await getNextNumero(tx);
    const fechaEmision = new Date(`${parsed.fecha_emision}T00:00:00`);
    const fechaVencimiento = parsed.fecha_vencimiento
      ? new Date(`${parsed.fecha_vencimiento}T00:00:00`)
      : null;
    const cotizacion = await tx.cotizacion.create({
      data: {
        ...campoNumeroCotizacion(numero),
        ...campoClienteCotizacion(cliente.id),
        ...campoFechaEmision(fechaEmision),
        ...campoFechaVencimiento(fechaVencimiento),
        is_tax_included: parsed.is_tax_included ?? false,
        terms: parsed.terms || null,
        subtotal,
        descuento: parsed.descuento ?? 0,
        total: calcularTotal(subtotal, parsed.descuento ?? 0),
        estado: "pendiente",
        creator: usuario.id,
      },
    });

    await tx.cotizacionItem.createMany({
      data: parsed.items.map((it) => ({
        cotizacion_id: cotizacion.id,
        quotation_id: cotizacion.id,
        ...campoLineaCotizacion(it),
      })),
    });

    return { id: cotizacion.id, advertencias };
  });
}

export async function cambiarEstadoCotizacion(
  id: string,
  estado: string,
): Promise<void> {
  const parsed = cambiarEstadoCotizacionSchema.parse({ id, estado });
  const row = await prisma.cotizacion.findUnique({ where: { id } });
  if (!row) throw new Error("Cotización no encontrada");
  const estadosFinales: string[] = ["aprobada", "rechazada", "caducada"];
  if (row.estado && estadosFinales.includes(row.estado)) {
    throw new Error("La cotización ya fue procesada");
  }
  await prisma.cotizacion.update({
    where: { id: parsed.id },
    data: { estado: parsed.estado },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Resumen para el índice
// ────────────────────────────────────────────────────────────────────────────

export async function getResumenCotizaciones(): Promise<ResumenCotizacionesDTO> {
  const rows = await prisma.cotizacion.findMany({
    select: { estado: true, total: true },
  });
  const count = (estado: string) => rows.filter((r) => r.estado === estado).length;
  const monto = (estado: string) =>
    rows
      .filter((r) => r.estado === estado)
      .reduce((s, r) => s + Number(r.total ?? 0), 0);

  return {
    total_cotizaciones: rows.length,
    pendientes: count("pendiente"),
    aprobadas: count("aprobada"),
    rechazadas: count("rechazada"),
    monto_pendiente: monto("pendiente"),
    monto_aprobado: monto("aprobada"),
  };
}