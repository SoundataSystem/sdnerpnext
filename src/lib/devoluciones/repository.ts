import "server-only";
import { prisma } from "@/lib/prisma";
import { bloquearFila } from "@/lib/prisma/locks";
import type {
  DevolucionVenta,
  DevolucionVentaItem,
  DevolucionCompra,
  DevolucionCompraItem,
  Cliente,
  Orden,
  OrdenesCompra,
  Proveedor,
  Producto,
  EstadoDevolucion,
} from "@/generated/prisma/client";
import {
  crearDevolucionVentaSchema,
  crearDevolucionCompraSchema,
  procesarDevolucionSchema,
  type CrearDevolucionVentaInput,
  type CrearDevolucionCompraInput,
} from "@/lib/devoluciones/schema";
import { calcularSubtotal } from "@/lib/devoluciones/calculos";
import {
  incrementarStockDeposito,
  decrementarStockDeposito,
  getDepositoRestitucion,
  getDepositoConStock,
} from "@/lib/inventario/stock";
import { reactivarSerie } from "@/lib/servicios/series";
import {
  formatearNumero,
  getNextNumero as siguienteNumero,
} from "@/lib/numeracion";
import {
  serialesARestituir,
  type ItemOrdenConSerial,
} from "@/lib/servicios/garantias";
import {
  ejecutarOperacionCritica,
  generarClaveOperacionCritica,
  validarTransicionEntidad,
} from "@/lib/operaciones/idempotencia-estados";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tipos del dominio (DTOs serializables)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DevolucionItemDTO {
  item_id: string;
  producto_id: string;
  producto_codigo: string | null;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  motivo_item: string | null;
}

export interface DevolucionVentaDTO {
  id: string;
  numero_devolucion: string | null;
  orden_id: string | null;
  orden_numero: string | null;
  cliente_nombre: string | null;
  motivo: string | null;
  subtotal: number;
  estado: string;
  created_at: string;
  items: DevolucionItemDTO[];
}

export interface DevolucionCompraDTO {
  id: string;
  numero_devolucion: string | null;
  orden_compra_id: string | null;
  orden_compra_numero: string | null;
  proveedor_nombre: string | null;
  motivo: string | null;
  subtotal: number;
  estado: string;
  created_at: string;
  items: DevolucionItemDTO[];
}

export interface ResumenDevolucionesDTO {
  ventas_pendientes: number;
  ventas_aprobadas: number;
  ventas_rechazadas: number;
  compras_pendientes: number;
  compras_aprobadas: number;
  monto_devuelto: number;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mappers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type DevVentaRaw = DevolucionVenta & {
  cliente?: Cliente | null;
  orden?: Orden | null;
  items?: (DevolucionVentaItem & { producto?: Producto | null })[];
};

function toDevolucionVenta(d: DevVentaRaw): DevolucionVentaDTO {
  return {
    id: d.id,
    numero_devolucion: numeroDevolucionVenta(d),
    orden_id: d.orden_id ?? d.delivery_id ?? null,
    orden_numero: d.orden?.numero_orden ?? null,
    cliente_nombre: d.cliente
      ? `${d.cliente.nombre} ${d.cliente.apellido ?? ""}`.trim()
      : null,
    motivo: d.motivo ?? d.reason ?? null,
    subtotal: Number(d.subtotal ?? 0),
    estado: (d.estado ?? "pendiente") as string,
    created_at: d.created_at.toISOString(),
    items: (d.items ?? []).map((it) => ({
      item_id: it.id,
      producto_id: it.producto_id,
      producto_codigo: it.producto?.codigo ?? null,
      producto_nombre: it.producto?.nombre ?? "â€”",
      cantidad: it.cantidad,
      precio_unitario: Number(it.precio_unitario),
      subtotal: Number(it.subtotal),
      motivo_item: it.motivo_item,
    })),
  };
}

type DevCompraRaw = DevolucionCompra & {
  proveedor?: Proveedor | null;
  supplier?: Proveedor | null;
  ordenCompra?: OrdenesCompra | null;
  items?: (DevolucionCompraItem & { producto?: Producto | null })[];
};

function toDevolucionCompra(d: DevCompraRaw): DevolucionCompraDTO {
  return {
    id: d.id,
    numero_devolucion: numeroDevolucionCompra(d),
    orden_compra_id: d.orden_compra_id ?? d.po_id ?? null,
    orden_compra_numero: d.ordenCompra?.numero_orden ?? null,
    proveedor_nombre: d.proveedor?.supplier ?? d.supplier?.supplier ?? null,
    motivo: d.motivo ?? d.remarks ?? null,
    subtotal: Number(d.subtotal ?? 0),
    estado: (d.estado ?? "pendiente") as string,
    created_at: d.created_at.toISOString(),
    items: (d.items ?? []).map((it) => ({
      item_id: it.id,
      producto_id: it.producto_id,
      producto_codigo: it.producto?.codigo ?? null,
      producto_nombre: it.producto?.nombre ?? "â€”",
      cantidad: it.cantidad,
      precio_unitario: Number(it.precio_unitario),
      subtotal: Number(it.subtotal),
      motivo_item: it.motivo_item,
    })),
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Nomenclatura v2 â†” legacy (P2-3): single source of truth para mantener los
// campos legacy (delivery_no, customer_id, po_id, supplier_id, reason/remarks,
// supplier_order_number) SIEMPRE sincronizados con los v2 al escribir/leer.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const campoNumeroDevolucionVenta = (v: string) => ({
  numero_devolucion: v,
  delivery_no: v,
});
const campoOrdenDevolucionVenta = (v: string) => ({
  orden_id: v,
  delivery_id: v,
});
const campoClienteDevolucionVenta = (v: string | null) => ({
  cliente_id: v,
  customer_id: v,
});
const campoMotivoDevolucionVenta = (v: string) => ({ motivo: v, reason: v });
const campoNumeroDevolucionCompra = (v: string) => ({
  numero_devolucion: v,
  supplier_order_number: v,
});
const campoOrdenDevolucionCompra = (v: string) => ({
  orden_compra_id: v,
  po_id: v,
});
const campoProveedorDevolucionCompra = (v: string) => ({
  proveedor_id: v,
  supplier_id: v,
});
const campoMotivoDevolucionCompra = (v: string) => ({ motivo: v, remarks: v });

function numeroDevolucionVenta(d: DevolucionVenta): string | null {
  return d.numero_devolucion ?? d.delivery_no ?? null;
}
function numeroDevolucionCompra(d: DevolucionCompra): string | null {
  return d.numero_devolucion ?? d.supplier_order_number ?? null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NumeraciÃ³n
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getNextNumero(
  caller: { $queryRaw<U>(q: TemplateStringsArray, ...v: unknown[]): Promise<U> },
  tipo: "devolucion_venta" | "devolucion_compra",
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    prefix,
    year,
    await siguienteNumero(caller, tipo, year),
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Devoluciones de VENTA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getDevolucionesVenta(filtro?: {
  estado?: string;
  busqueda?: string;
}): Promise<DevolucionVentaDTO[]> {
  const rows = await prisma.devolucionVenta.findMany({
    where:
      filtro?.estado && filtro.estado !== "todos"
        ? { estado: filtro.estado as EstadoDevolucion }
        : undefined,
    include: {
      cliente: true,
      orden: true,
      items: { include: { producto: true } },
    },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });
  const mapped = rows.map(toDevolucionVenta);
  if (filtro?.busqueda?.trim()) {
    const q = filtro.busqueda.toLowerCase();
    return mapped.filter(
      (d) =>
        d.numero_devolucion?.toLowerCase().includes(q) ||
        d.cliente_nombre?.toLowerCase().includes(q) ||
        d.orden_numero?.toLowerCase().includes(q),
    );
  }
  return mapped;
}

export async function getDevolucionVenta(
  id: string,
): Promise<DevolucionVentaDTO | null> {
  const row = await prisma.devolucionVenta.findUnique({
    where: { id },
    include: {
      cliente: true,
      orden: true,
      items: { include: { producto: true } },
    },
  });
  return row ? toDevolucionVenta(row) : null;
}

export async function crearDevolucionVenta(
  data: CrearDevolucionVentaInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = crearDevolucionVentaSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const orden = await tx.orden.findUnique({
      where: { id: parsed.orden_id },
      include: { items: true },
    });
    if (!orden) throw new Error("Orden de venta no encontrada");

    const itemsOrden = orden.items ?? [];
    const porProducto = new Map<string, number>();
    for (const it of itemsOrden) {
      porProducto.set(
        it.producto_id,
        Number(porProducto.get(it.producto_id) ?? 0) + Number(it.cantidad),
      );
    }

    // Lo ya devuelto (pendiente + aprobado) para esta orden: evita que la
    // suma de devoluciones parciales exceda lo vendido.
    const devolucionesPrevias = await tx.devolucionVenta.findMany({
      where: { orden_id: orden.id, estado: { in: ["pendiente", "aprobada"] } },
      select: { items: { select: { producto_id: true, cantidad: true } } },
    });
    const yaDevuelto = new Map<string, number>();
    for (const dev of devolucionesPrevias) {
      for (const it of dev.items) {
        yaDevuelto.set(
          it.producto_id,
          Number(yaDevuelto.get(it.producto_id) ?? 0) + Number(it.cantidad),
        );
      }
    }

    for (const item of parsed.items) {
      const vendido = porProducto.get(item.producto_id) ?? 0;
      const devuelto = yaDevuelto.get(item.producto_id) ?? 0;
      if (item.cantidad > vendido - devuelto) {
        throw new Error(
          `La cantidad total devuelta supera lo vendido para un producto (vendido ${vendido}, ya devuelto ${devuelto})`,
        );
      }
    }

    const numero = await getNextNumero(tx, "devolucion_venta", "DV");
    const subtotal = calcularSubtotal(parsed.items);

    const devolucion = await tx.devolucionVenta.create({
      data: {
        ...campoNumeroDevolucionVenta(numero),
        ...campoOrdenDevolucionVenta(orden.id),
        ...campoClienteDevolucionVenta(orden.cliente_id),
        ...campoMotivoDevolucionVenta(parsed.motivo),
        subtotal,
        estado: "pendiente",
        creator: usuario.id,
      },
    });

    await tx.devolucionVentaItem.createMany({
      data: parsed.items.map((it) => ({
        devolucion_id: devolucion.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
      })),
    });

    return devolucion.id;
  });
}

export async function aprobarDevolucionVenta(
  id: string,
  usuario: { id: string; nombre: string; rol?: string },
): Promise<void> {
  procesarDevolucionSchema.parse({ id });

  // OperaciÃ³n crÃ­tica: idempotencia (doble click = Ã©xito-no-op), lock FOR
  // UPDATE, transiciÃ³n pendienteâ†’aprobada por mÃ¡quina de estados y evento
  // outbox, atÃ³mico en Serializable.
  await ejecutarOperacionCritica(
    "devolucion_venta",
    "aprobacion.devolucion",
    generarClaveOperacionCritica("devolucion_venta", "aprobar", id),
    id,
    (estadoActual) => {
      const v = validarTransicionEntidad(
        "devolucion_venta",
        estadoActual,
        "aprobada",
      );
      return {
        valido: v.valido,
        error:
          v.error ??
          (v.valido
            ? undefined
            : "Solo las devoluciones pendientes pueden aprobarse"),
      };
    },
    async (tx) => {
    const devolucionCompleta = await tx.devolucionVenta.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!devolucionCompleta) throw new Error("DevoluciÃ³n no encontrada");

    // P4: orden estable por producto_id â†’ locks FOR UPDATE deterministas
    const itemsRestitucion = [...devolucionCompleta.items].sort((a, b) =>
      a.producto_id.localeCompare(b.producto_id),
    );
    for (const item of itemsRestitucion) {
      const deposito = await getDepositoRestitucion(tx, item.producto_id);
      if (!deposito) {
        throw new Error(
          "No existe un depÃ³sito para restituir stock del producto de la devoluciÃ³n",
        );
      }
      const resultado = await incrementarStockDeposito(
        tx,
        item.producto_id,
        deposito.id,
        item.cantidad,
      );

      const producto = await tx.producto.findUnique({
        where: { id: item.producto_id },
      });

      await tx.movimientoInventario.create({
        data: {
          tipo: "devolucion",
          producto_id: item.producto_id,
          producto_nombre: producto?.nombre ?? null,
          producto_codigo: producto?.codigo ?? null,
          cantidad: item.cantidad,
          stock_anterior: resultado.total_anterior,
          stock_nuevo: resultado.total_nuevo,
          deposito_destino: deposito.nombre,
          referencia: numeroDevolucionVenta(devolucionCompleta),
          motivo: `DevoluciÃ³n de venta - ${devolucionCompleta.motivo ?? ""}`,
          observaciones: "Stock restituido por devoluciÃ³n aprobada",
          usuario_nombre: usuario.nombre ?? "Admin",
        },
      });

      // Reactivar series del producto devuelto (estaban activo=false por la
      // venta original). Se restituyen hasta `cantidad` seriales de la orden.
      if (devolucionCompleta.orden_id) {
        const ordenItems = await tx.ordenProducto.findMany({
          where: {
            orden_id: devolucionCompleta.orden_id,
            producto_id: item.producto_id,
          },
          select: { serial: true, serial_producto: true },
        });
        const seriales: ItemOrdenConSerial[] = ordenItems.map((oi) => ({
          serial: oi.serial,
          serial_producto: oi.serial_producto,
        }));
        for (const serial of serialesARestituir(seriales, item.cantidad)) {
          await reactivarSerie(tx, item.producto_id, serial);
        }
      }
    }

    await tx.devolucionVenta.update({
      where: { id },
      data: { estado: "aprobada", procesada_at: new Date() },
    });

      return { entidadId: id, tipoEventoOutbox: "aprobacion.devolucion" };
    },
    {
      actorId: usuario.id,
      actorNombre: usuario.nombre,
      actorRol: usuario.rol ?? "sistema",
    },
  );
}

export async function rechazarDevolucionVenta(
  id: string,
): Promise<void> {
  procesarDevolucionSchema.parse({ id });
  return prisma.$transaction(async (tx) => {
    const devolucion = await bloquearFila<{ id: string; estado: string }>(
      tx,
      "devolucion_venta",
      id,
    );
    if (!devolucion) throw new Error("DevoluciÃ³n no encontrada");
    if (devolucion.estado !== "pendiente") {
      throw new Error("Solo las devoluciones pendientes pueden rechazarse");
    }
    await tx.devolucionVenta.update({
      where: { id },
      data: { estado: "rechazada" },
    });
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Devoluciones de COMPRA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getDevolucionesCompra(filtro?: {
  estado?: string;
  busqueda?: string;
}): Promise<DevolucionCompraDTO[]> {
  const rows = await prisma.devolucionCompra.findMany({
    where:
      filtro?.estado && filtro.estado !== "todos"
        ? { estado: filtro.estado as EstadoDevolucion }
        : undefined,
    include: {
      proveedor: true,
      supplier: true,
      ordenCompra: true,
      items: { include: { producto: true } },
    },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });
  const mapped = rows.map(toDevolucionCompra);
  if (filtro?.busqueda?.trim()) {
    const q = filtro.busqueda.toLowerCase();
    return mapped.filter(
      (d) =>
        d.numero_devolucion?.toLowerCase().includes(q) ||
        d.proveedor_nombre?.toLowerCase().includes(q) ||
        d.orden_compra_numero?.toLowerCase().includes(q),
    );
  }
  return mapped;
}

export async function getDevolucionCompra(
  id: string,
): Promise<DevolucionCompraDTO | null> {
  const row = await prisma.devolucionCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      supplier: true,
      ordenCompra: true,
      items: { include: { producto: true } },
    },
  });
  return row ? toDevolucionCompra(row) : null;
}

export async function crearDevolucionCompra(
  data: CrearDevolucionCompraInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = crearDevolucionCompraSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const oc = await tx.ordenesCompra.findUnique({
      where: { id: parsed.orden_compra_id },
      include: { items: true },
    });
    if (!oc) throw new Error("Orden de compra no encontrada");

    const itemsOc = oc.items ?? [];
    const porProducto = new Map<string, number>();
    for (const it of itemsOc) {
      const recibido =
        Number(it.cantidad_recibida ?? 0) || Number(it.quantity ?? 0);
      porProducto.set(
        it.producto_id ?? "",
        Number(porProducto.get(it.producto_id ?? "") ?? 0) + recibido,
      );
    }

    // Lo ya devuelto al proveedor (pendiente + aprobado) para esta OC.
    const devolucionesPrevias = await tx.devolucionCompra.findMany({
      where: {
        orden_compra_id: oc.id,
        estado: { in: ["pendiente", "aprobada"] },
      },
      select: { items: { select: { producto_id: true, cantidad: true } } },
    });
    const yaDevuelto = new Map<string, number>();
    for (const dev of devolucionesPrevias) {
      for (const it of dev.items) {
        yaDevuelto.set(
          it.producto_id,
          Number(yaDevuelto.get(it.producto_id) ?? 0) + Number(it.cantidad),
        );
      }
    }

    for (const item of parsed.items) {
      const recibido = porProducto.get(item.producto_id) ?? 0;
      const devuelto = yaDevuelto.get(item.producto_id) ?? 0;
      if (item.cantidad > recibido - devuelto) {
        throw new Error(
          `La cantidad total devuelta supera lo recibido del proveedor para un producto (recibido ${recibido}, ya devuelto ${devuelto})`,
        );
      }
    }

    const numero = await getNextNumero(tx, "devolucion_compra", "DC");
    const subtotal = calcularSubtotal(parsed.items);

    const devolucion = await tx.devolucionCompra.create({
      data: {
        ...campoNumeroDevolucionCompra(numero),
        ...campoOrdenDevolucionCompra(oc.id),
        ...campoProveedorDevolucionCompra(parsed.proveedor_id),
        ...campoMotivoDevolucionCompra(parsed.motivo),
        subtotal,
        estado: "pendiente",
        creator: usuario.id,
      },
    });

    await tx.devolucionCompraItem.createMany({
      data: parsed.items.map((it) => ({
        devolucion_id: devolucion.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
      })),
    });

    return devolucion.id;
  });
}

export async function aprobarDevolucionCompra(
  id: string,
  usuario: { id: string; nombre: string; rol?: string },
): Promise<void> {
  procesarDevolucionSchema.parse({ id });

  // OperaciÃ³n crÃ­tica: idempotencia (doble click = Ã©xito-no-op), lock FOR
  // UPDATE, transiciÃ³n pendienteâ†’aprobada y evento outbox, atÃ³mico.
  await ejecutarOperacionCritica(
    "devolucion_compra",
    "aprobacion.devolucion",
    generarClaveOperacionCritica("devolucion_compra", "aprobar", id),
    id,
    (estadoActual) => {
      const v = validarTransicionEntidad(
        "devolucion_compra",
        estadoActual,
        "aprobada",
      );
      return {
        valido: v.valido,
        error:
          v.error ??
          (v.valido
            ? undefined
            : "Solo las devoluciones pendientes pueden aprobarse"),
      };
    },
    async (tx) => {
    const devolucionCompleta = await tx.devolucionCompra.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!devolucionCompleta) throw new Error("DevoluciÃ³n no encontrada");

    // P4: orden estable por producto_id â†’ locks FOR UPDATE deterministas
    const itemsOrdenados = [...devolucionCompleta.items].sort((a, b) =>
      a.producto_id.localeCompare(b.producto_id),
    );
    for (const item of itemsOrdenados) {
      const deposito = await getDepositoConStock(tx, item.producto_id, item.cantidad);
      if (!deposito) {
        throw new Error(
          `Stock insuficiente en un solo depÃ³sito para el producto correspondiente a la devoluciÃ³n de compra`,
        );
      }
      const resultado = await decrementarStockDeposito(
        tx,
        item.producto_id,
        deposito.id,
        item.cantidad,
      );

      const producto = await tx.producto.findUnique({
        where: { id: item.producto_id },
      });

      await tx.movimientoInventario.create({
        data: {
          tipo: "devolucion",
          producto_id: item.producto_id,
          producto_nombre: producto?.nombre ?? null,
          producto_codigo: producto?.codigo ?? null,
          cantidad: item.cantidad,
          stock_anterior: resultado.total_anterior,
          stock_nuevo: resultado.total_nuevo,
          deposito_origen: deposito.nombre,
          referencia: numeroDevolucionCompra(devolucionCompleta),
          motivo: `DevoluciÃ³n a proveedor - ${devolucionCompleta.motivo ?? ""}`,
          observaciones: "Stock egresado por devoluciÃ³n a proveedor aprobada",
          usuario_nombre: usuario.nombre ?? "Admin",
        },
      });
    }

    await tx.devolucionCompra.update({
      where: { id },
      data: { estado: "aprobada" },
    });

      return { entidadId: id, tipoEventoOutbox: "aprobacion.devolucion" };
    },
    {
      actorId: usuario.id,
      actorNombre: usuario.nombre,
      actorRol: usuario.rol ?? "sistema",
    },
  );
}

export async function rechazarDevolucionCompra(
  id: string,
): Promise<void> {
  procesarDevolucionSchema.parse({ id });
  return prisma.$transaction(async (tx) => {
    const devolucion = await bloquearFila<{ id: string; estado: string }>(
      tx,
      "devolucion_compra",
      id,
    );
    if (!devolucion) throw new Error("DevoluciÃ³n no encontrada");
    if (devolucion.estado !== "pendiente") {
      throw new Error("Solo las devoluciones pendientes pueden rechazarse");
    }
    await tx.devolucionCompra.update({
      where: { id },
      data: { estado: "rechazada" },
    });
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Resumen para el Ã­ndice
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getResumenDevoluciones(): Promise<ResumenDevolucionesDTO> {
  const [ventas, compras] = await Promise.all([
    prisma.devolucionVenta.findMany({
      select: { estado: true, subtotal: true },
    }),
    prisma.devolucionCompra.findMany({
      select: { estado: true, subtotal: true },
    }),
  ]);

  const count = (rows: { estado: string }[], estado: string) =>
    rows.filter((r) => r.estado === estado).length;

  return {
    ventas_pendientes: count(ventas, "pendiente"),
    ventas_aprobadas: count(ventas, "aprobada"),
    ventas_rechazadas: count(ventas, "rechazada"),
    compras_pendientes: count(compras, "pendiente"),
    compras_aprobadas: count(compras, "aprobada"),
    monto_devuelto: ventas
      .filter((r) => r.estado === "aprobada")
      .reduce((s, r) => s + Number(r.subtotal ?? 0), 0),
  };
}