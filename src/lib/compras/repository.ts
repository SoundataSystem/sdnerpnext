import "server-only";
import { prisma } from "@/lib/prisma";
import { bloquearFila } from "@/lib/prisma/locks";
import {
  ejecutarOperacionCritica,
  generarClaveOperacionCritica,
  validarTransicionEntidad,
} from "@/lib/operaciones/idempotencia-estados";
import type {
  Proveedor,
  OrdenesCompra,
  OrdenesCompraItem,
  Producto,
} from "@/generated/prisma/client";
import {
  crearProveedorSchema,
  actualizarProveedorSchema,
  crearOcSchema,
  registrarRecepcionSchema,
  ingresarStockSchema,
  registrarPagoProveedorSchema,
  type CrearProveedorInput,
  type ActualizarProveedorInput,
  type CrearOcInput,
  type RegistrarRecepcionInput,
  type RegistrarPagoProveedorInput,
  type EstadoOrdenCompra,
} from "@/lib/compras/schema";
import {
  calcularSubtotal,
  calcularImpuestos,
  calcularCostoOperativo,
  calcularTotal,
} from "@/lib/compras/calculos";
import {
  errorEstadoRecepcion,
  errorSobreRecepcion,
  errorPagoSuperaSaldo,
  todosLosItemsCompletos,
} from "@/lib/compras/validaciones";
import { incrementarStockDeposito } from "@/lib/inventario/stock";
import {
  formatearNumero,
  getNextNumero,
  getProximoNumero,
} from "@/lib/numeracion";

// ────────────────────────────────────────────────────────────────────────────
// Tipos del dominio (DTOs serializables)
// ────────────────────────────────────────────────────────────────────────────

export interface ProveedorDTO {
  id: string;
  supplier: string;
  tax: string | null;
  phone: string | null;
  address: string | null;
  document_type: string | null;
  term: string | null;
  condition_description: string | null;
  tiene_acuerdo_comercial: boolean | null;
  created_at: string;
}

export interface OcItemDTO {
  item_id: string;
  producto_id: string;
  producto_codigo: string | null;
  producto_nombre: string;
  cantidad: number;
  unit_price: number;
  cantidad_recibida: number;
}

export interface OcDTO {
  id: string;
  numero_orden: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  fecha_emision: string | null;
  is_tax_included: boolean | null;
  subtotal: number;
  impuestos: number;
  costo_operativo: number;
  total: number;
  estado: string;
  remarks: string | null;
  warehouse: string | null;
  enviada_at: string | null;
  created_at: string;
  items: OcItemDTO[];
}

export interface ProductoCompraDTO {
  id: string;
  codigo: string | null;
  nombre: string;
  barcode: string | null;
  purchase_cost: number;
  stock_total: number;
  activo: boolean | null;
}

export interface PagoProveedorDTO {
  id: string;
  oc_id: string | null;
  oc_numero: string | null;
  proveedor_nombre: string | null;
  monto: number;
  metodo_pago: string | null;
  numero_factura: string | null;
  referencia: string | null;
  fecha_pago: string | null;
  created_at: string;
}

export interface CuentaPagarDTO {
  id: string;
  oc_id: string | null;
  proveedor_nombre: string;
  oc_numero: string | null;
  monto_total: number;
  saldo_pendiente: number;
  estado: string;
  fecha_vencimiento: string | null;
}

export interface DepositoDTO {
  id: string;
  nombre: string;
}

export interface ResumenComprasDTO {
  total_proveedores: number;
  ocs_borrador: number;
  ocs_pendientes: number;
  ocs_ingresadas: number;
  ocs_canceladas: number;
  total_cp_pendiente: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers
// ────────────────────────────────────────────────────────────────────────────

function toProveedor(p: Proveedor): ProveedorDTO {
  return {
    id: p.id,
    supplier: p.supplier ?? "—",
    tax: p.tax,
    phone: p.phone,
    address: p.address,
    document_type: p.document_type,
    term: p.term,
    condition_description: p.condition_description,
    tiene_acuerdo_comercial: p.tiene_acuerdo_comercial,
    created_at: p.create_date?.toISOString() ?? "",
  };
}

type OcRaw = OrdenesCompra & {
  proveedor?: Proveedor | null;
  items?: (OrdenesCompraItem & { producto?: Producto | null })[];
};

function toOc(raw: OcRaw): OcDTO {
  return {
    id: raw.id,
    numero_orden: raw.numero_orden ?? "",
    proveedor_id: raw.proveedor_id,
    proveedor_nombre: raw.proveedor?.supplier ?? null,
    fecha_emision: raw.fecha_emision?.toISOString().split("T")[0] ?? null,
    is_tax_included: raw.is_tax_included,
    subtotal: Number(raw.subtotal ?? 0),
    impuestos: Number(raw.impuestos ?? 0),
    costo_operativo: Number(raw.costo_operativo ?? 0),
    total: Number(raw.total ?? 0),
    estado: raw.estado as string,
    remarks: raw.remarks,
    warehouse: raw.warehouse,
    enviada_at: raw.enviada_at?.toISOString() ?? null,
    created_at: raw.created_at.toISOString(),
    items: (raw.items ?? []).map((it) => ({
      item_id: it.item_id,
      producto_id: it.producto_id ?? "",
      producto_codigo: it.producto?.codigo ?? null,
      producto_nombre: it.producto?.nombre ?? "—",
      cantidad: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      cantidad_recibida: Number(it.cantidad_recibida ?? 0),
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Proveedores
// ────────────────────────────────────────────────────────────────────────────

export async function getProveedores(busqueda?: string): Promise<ProveedorDTO[]> {
  const rows = await prisma.proveedor.findMany({
    where: busqueda?.trim()
      ? {
          OR: [
            { supplier: { contains: busqueda, mode: "insensitive" } },
            { tax: { contains: busqueda } },
          ],
        }
      : undefined,
    orderBy: [{ supplier: "asc" }],
    take: 1000,
  });
  return rows.map(toProveedor);
}

export async function getProveedor(id: string): Promise<ProveedorDTO | null> {
  const row = await prisma.proveedor.findUnique({ where: { id } });
  return row ? toProveedor(row) : null;
}

export async function crearProveedor(
  data: CrearProveedorInput,
): Promise<ProveedorDTO> {
  const parsed = crearProveedorSchema.parse(data);
  const p = await prisma.proveedor.create({
    data: {
      supplier: parsed.supplier,
      tax: parsed.tax || null,
      phone: parsed.phone || null,
      address: parsed.address || null,
      document_type: parsed.document_type || null,
      term: parsed.term || null,
      condition_description: parsed.condition_description || null,
      tiene_acuerdo_comercial: parsed.tiene_acuerdo_comercial ?? false,
    },
  });
  return toProveedor(p);
}

export async function actualizarProveedor(
  id: string,
  data: ActualizarProveedorInput,
): Promise<void> {
  const parsed = actualizarProveedorSchema.parse(data);
  const patch: Record<string, unknown> = {};
  if (parsed.supplier !== undefined) patch.supplier = parsed.supplier;
  if (parsed.tax !== undefined) patch.tax = parsed.tax || null;
  if (parsed.phone !== undefined) patch.phone = parsed.phone || null;
  if (parsed.address !== undefined) patch.address = parsed.address || null;
  if (parsed.document_type !== undefined)
    patch.document_type = parsed.document_type || null;
  if (parsed.term !== undefined) patch.term = parsed.term || null;
  if (parsed.condition_description !== undefined)
    patch.condition_description = parsed.condition_description || null;
  if (parsed.tiene_acuerdo_comercial !== undefined)
    patch.tiene_acuerdo_comercial = parsed.tiene_acuerdo_comercial;

  await prisma.proveedor.update({ where: { id }, data: patch });
}

// ────────────────────────────────────────────────────────────────────────────
// Catálogo de productos para compras
// ────────────────────────────────────────────────────────────────────────────

export async function getProductosCompra(): Promise<ProductoCompraDTO[]> {
  const rows = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    take: 1000,
  });
  return rows.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    barcode: p.barcode,
    purchase_cost: Number(p.purchase_cost ?? 0),
    stock_total: Number(p.stock_total ?? 0),
    activo: p.activo,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Números atómicos (patrón de contabilidad/ventas)
// ────────────────────────────────────────────────────────────────────────────

type QueryExec = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
};

export async function getNextOrdenCompraNumber(
  caller: QueryExec = prisma,
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "OC",
    year,
    await getNextNumero(caller, "orden_compra", year),
  );
}

export async function getProximoOrdenCompraNumber(): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "OC",
    year,
    await getProximoNumero(prisma, "orden_compra", year),
  );
}

async function getNextRecepcionNumber(
  caller: QueryExec,
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "RC",
    year,
    await getNextNumero(caller, "recepcion", year),
  );
}

async function getNextIngresoNumber(caller: QueryExec): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "IG",
    year,
    await getNextNumero(caller, "ingreso", year),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Órdenes de Compra
// ────────────────────────────────────────────────────────────────────────────

export async function getOrdenesCompra(filtro?: {
  estado?: string;
  busqueda?: string;
}): Promise<OcDTO[]> {
  const rows = await prisma.ordenesCompra.findMany({
    where:
      filtro?.estado && filtro.estado !== "todos"
        ? { estado: filtro.estado as EstadoOrdenCompra }
        : undefined,
    include: {
      proveedor: true,
      items: { include: { producto: true } },
    },
    orderBy: [{ created_at: "desc" }],
    take: 1000,
  });
  if (filtro?.busqueda?.trim()) {
    const q = filtro.busqueda.toLowerCase();
    return rows
      .filter(
        (r) =>
          r.numero_orden?.toLowerCase().includes(q) ||
          r.proveedor?.supplier?.toLowerCase().includes(q),
      )
      .map(toOc);
  }
  return rows.map(toOc);
}

export async function getOrdenCompra(id: string): Promise<OcDTO | null> {
  const row = await prisma.ordenesCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      items: { include: { producto: true } },
    },
  });
  return row ? toOc(row) : null;
}

// OCs en el flujo activo: listas para recibir o para ingresar a stock.
export async function getOcsFlujoActivo(): Promise<OcDTO[]> {
  const rows = await prisma.ordenesCompra.findMany({
    where: {
      estado: {
        in: ["enviada", "recepcion_parcial", "pendiente_ingreso_stock"],
      },
    },
    include: {
      proveedor: true,
      items: { include: { producto: true } },
    },
    orderBy: [{ created_at: "asc" }],
    take: 100,
  });
  return rows.map(toOc);
}

export async function crearOrdenCompra(
  input: CrearOcInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = crearOcSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const proveedor = await tx.proveedor.findUnique({
      where: { id: parsed.proveedor_id },
    });
    if (!proveedor) throw new Error("Proveedor no encontrado");

    const productoIds = [...new Set(parsed.items.map((i) => i.producto_id))];
    const productos = await tx.producto.findMany({
      where: { id: { in: productoIds } },
    });
    if (productos.length !== productoIds.length) {
      throw new Error("Uno o más productos no existen");
    }
    const inactivo = productos.find((p) => p.activo === false);
    if (inactivo) {
      throw new Error(`Producto inactivo: ${inactivo.codigo ?? inactivo.nombre}`);
    }

    const subtotal = calcularSubtotal(parsed.items);
    const impuestos = calcularImpuestos(subtotal, parsed.is_tax_included ?? false);

    const config = await tx.configuracionSistema.findFirst();
    const pctCostoOp = Number(config?.costo_operativo_global ?? 0);
    const costoOperativo = calcularCostoOperativo(subtotal, pctCostoOp);

    const numero = await getNextOrdenCompraNumber(tx);
    const oc = await tx.ordenesCompra.create({
      data: {
        numero_orden: numero,
        proveedor_id: parsed.proveedor_id,
        is_tax_included: parsed.is_tax_included ?? false,
        remarks: parsed.remarks || null,
        warehouse: parsed.warehouse || null,
        subtotal,
        impuestos,
        costo_operativo: costoOperativo,
        porcentaje_costo_operativo: pctCostoOp,
        total: calcularTotal(subtotal, impuestos, costoOperativo),
        estado: "borrador",
        creator: usuario.id,
        fecha_emision: new Date(),
      },
    });

    await tx.ordenesCompraItem.createMany({
      data: parsed.items.map((it) => ({
        po_id: oc.id,
        producto_id: it.producto_id,
        quantity: it.cantidad,
        unit_price: it.unit_price,
        cantidad_recibida: 0,
        currency: "GS",
        status: "pending",
      })),
    });

    return oc.id;
  });
}

// Transiciones de estado de la OC:
//  aprobar  : borrador -> aprobada
//  enviar   : aprobada  -> enviada        (se crea la cuenta por pagar)
//  cancelar : cualquiera -> cancelada      (se cancela la CxP si existe)
//  cerrar   : ingresada  -> cerrada
export async function transicionEstadoOc(
  id: string,
  accion: "aprobar" | "enviar" | "cancelar" | "cerrar",
  usuario?: { id: string; nombre: string; apellido: string | null; rol: string },
): Promise<void> {
  // Operación crítica: idempotencia (dos "enviar" no crean 2 CxP), lock FOR
  // UPDATE, validación por máquina de estados y evento outbox, todo atómico.
  const tipoIdempotencia = {
    aprobar: "aprobacion.oc",
    enviar: "oc.enviada",
    cancelar: "oc.cancelada",
    cerrar: "oc.cerrada",
  } as const;

  await ejecutarOperacionCritica(
    "orden_compra",
    tipoIdempotencia[accion],
    generarClaveOperacionCritica("orden_compra", accion, id),
    id,
    (estadoActual) => validarTransicionEntidad("orden_compra", estadoActual, accion),
    async (tx) => {
      const oc = await tx.ordenesCompra.findUnique({
        where: { id },
        select: { total: true, proveedor_id: true },
      });
      if (!oc) throw new Error("OC no encontrada");

      const destino: Record<typeof accion, EstadoOrdenCompra> = {
        aprobar: "aprobada",
        enviar: "enviada",
        cancelar: "cancelada",
        cerrar: "cerrada",
      };

      await tx.ordenesCompra.update({
        where: { id },
        data: {
          estado: destino[accion],
          enviada_at: accion === "enviar" ? new Date() : undefined,
        },
      });

      if (accion === "enviar" && oc.proveedor_id) {
        const cp = await tx.cuentaPagar.findFirst({
          where: { orden_compra_id: id },
        });
        if (!cp) {
          await tx.cuentaPagar.create({
            data: {
              proveedor_id: oc.proveedor_id,
              orden_compra_id: id,
              monto_total: Number(oc.total ?? 0),
              saldo_pendiente: Number(oc.total ?? 0),
              fecha_emision: new Date(),
              estado: "pendiente",
            },
          });
        }
      }

      if (accion === "cancelar") {
        await tx.cuentaPagar.updateMany({
          where: { orden_compra_id: id, estado: { in: ["pendiente", "parcial"] } },
          data: { estado: "cancelado" },
        });
      }

      return { entidadId: id, tipoEventoOutbox: destino[accion] };
    },
    {
      actorId: usuario?.id,
      actorNombre: usuario
        ? `${usuario.nombre} ${usuario.apellido ?? ""}`.trim()
        : "Sistema",
      actorRol: usuario?.rol ?? "system",
    },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Recepción de mercadería
// ────────────────────────────────────────────────────────────────────────────

export async function registrarRecepcion(
  input: RegistrarRecepcionInput,
  usuario: { id: string; nombre: string },
): Promise<{ id: string; oc_id: string }> {
  const parsed = registrarRecepcionSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    // Lock de la OC: serializa recepciones concurrentes sobre la misma OC y
    // hace correcta la acumulación de cantidad_recibida (recepción parcial).
    await bloquearFila(tx, "orden_compra", parsed.oc_id);
    const oc = await tx.ordenesCompra.findUnique({
      where: { id: parsed.oc_id },
      include: { items: { include: { producto: true } } },
    });
    if (!oc) throw new Error("OC no encontrada");
    const errEstado = errorEstadoRecepcion(oc.estado);
    if (errEstado) throw new Error(errEstado);
    if (!oc.proveedor_id) throw new Error("La OC no tiene proveedor");

    const itemMap = new Map(oc.items.map((i) => [i.item_id, i]));

    // Las líneas pueden venir desglosadas (varias filas del mismo oc_item_id,
    // una por unidad para registrar su serial). Se agregan cantidades por
    // ítem para validar y actualizar la OC, pero se persiste una fila por
    // línea (serial/fotos/observaciones propios).
    interface LineaPersistente {
      producto_id: string;
      cantidad_solicitada: number;
      cantidad_recibida: number;
      precio_final: number;
      serial: string | null;
      observaciones: string | null;
      fotos: string[];
    }
    const lineas = new Map<string, LineaPersistente[]>();
    const agregado = new Map<
      string,
      { ocItem: (typeof oc.items)[number]; totalLineas: number }
    >();

    for (const it of parsed.items) {
      const ocItem = itemMap.get(it.oc_item_id);
      if (!ocItem)
        throw new Error("Uno o más ítems de recepción no pertenecen a la OC");
      const linea: LineaPersistente = {
        producto_id: ocItem.producto_id ?? "",
        cantidad_solicitada: Number(ocItem.quantity ?? 0),
        cantidad_recibida: it.cantidad_recibida,
        precio_final: Number(ocItem.unit_price ?? 0),
        serial: it.serial || null,
        observaciones: it.observaciones || null,
        fotos: it.fotos ?? [],
      };
      const previas = lineas.get(it.oc_item_id);
      if (previas) previas.push(linea);
      else lineas.set(it.oc_item_id, [linea]);

      const acc = agregado.get(it.oc_item_id);
      if (acc) acc.totalLineas += it.cantidad_recibida;
      else
        agregado.set(it.oc_item_id, {
          ocItem,
          totalLineas: it.cantidad_recibida,
        });
    }

    const recibidos = [...agregado.entries()].map(([item_id, acc]) => {
      const yaRecibido = Number(acc.ocItem.cantidad_recibida ?? 0);
      const solicitado = Number(acc.ocItem.quantity ?? 0);
      const total = yaRecibido + acc.totalLineas;
      // Validación mínima: negativo no permitido. El excedente (>solicitado) se permite
      // y solo se informa (el usuario pidió poder agregar igual, indicando mínimo 1).
      if (acc.totalLineas < 0) throw new Error("La cantidad recibida no puede ser negativa");
      if (total > solicitado) {
        console.warn(`[RECEPCION EXCEDENTE] ${acc.ocItem.producto?.nombre ?? ""}: ${total} > solicitado ${solicitado} (+${total - solicitado})`);
      }
      return {
        item_id,
        ocItem: acc.ocItem,
        totalRecibido: total,
      };
    });

    // Se evalúa sobre TODOS los ítems de la OC (la UI solo envía los recibidos).
    const totalesNuevos = new Map(
      recibidos.map((r) => [r.item_id, r.totalRecibido]),
    );
    const todasCompletas = todosLosItemsCompletos(
      oc.items.map((i) => ({
        id: i.item_id,
        cantidad: Number(i.quantity ?? 0),
        cantidad_recibida: Number(i.cantidad_recibida ?? 0),
      })),
      totalesNuevos,
    );

    const numero = await getNextRecepcionNumber(tx);
    const recepcion = await tx.recepcionCompra.create({
      data: {
        numero_recepcion: numero,
        orden_compra_id: oc.id,
        proveedor_id: oc.proveedor_id,
        usuario_recepcion_id: usuario.id,
        factura_numero: parsed.factura_numero || null,
        factura_fecha: parsed.factura_fecha
          ? new Date(`${parsed.factura_fecha}T00:00:00`)
          : null,
        factura_monto: parsed.factura_monto > 0 ? parsed.factura_monto : null,
        factura_archivo_url: parsed.factura_archivo_url || null,
        estado: "pendiente",
        observaciones: parsed.observaciones || null,
      },
    });

    await tx.recepcionCompraItem.createMany({
      data: [...lineas.entries()].flatMap(([ocItemId, lineasItem]) =>
        lineasItem.map((l) => ({
          recepcion_id: recepcion.id,
          producto_id: l.producto_id,
          cantidad_solicitada: l.cantidad_solicitada,
          cantidad_recibida: l.cantidad_recibida,
          precio_final: l.precio_final,
          serial: l.serial,
          observaciones: l.observaciones,
          fotos: l.fotos,
          estado: "pendiente" as const,
        })),
      ),
    });

    for (const r of recibidos) {
      await tx.ordenesCompraItem.update({
        where: { item_id: r.item_id },
        data: {
          cantidad_recibida: r.totalRecibido,
          status:
            r.totalRecibido >= Number(r.ocItem.quantity ?? 0)
              ? "received"
              : "partial",
        },
      });
    }

    await tx.ordenesCompra.update({
      where: { id: oc.id },
      data: {
        estado: todasCompletas ? "pendiente_ingreso_stock" : "recepcion_parcial",
      },
    });

    return { id: recepcion.id, oc_id: oc.id };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Ingreso a stock
// ────────────────────────────────────────────────────────────────────────────

export async function getDepositos(): Promise<DepositoDTO[]> {
  const rows = await prisma.deposito.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    take: 100,
  });
  return rows.map((d) => ({ id: d.id, nombre: d.nombre }));
}

export async function ingresarStock(
  input: { oc_id: string; deposito_id: string },
  usuario: { id: string; nombre: string },
): Promise<{ id: string; oc_id: string }> {
  const parsed = ingresarStockSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    // Lock: dos ingresos concurrentes se serializan; el guard de recepcion_id
    // se vuelve definitivo (no hay doble ingreso a stock).
    await bloquearFila(tx, "orden_compra", parsed.oc_id);
    const oc = await tx.ordenesCompra.findUnique({
      where: { id: parsed.oc_id },
      include: { items: { include: { producto: true } }, proveedor: true },
    });
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estado !== "pendiente_ingreso_stock") {
      throw new Error("Solo las OC con mercadería recibida pueden ingresarse a stock");
    }
    const deposito = await tx.deposito.findUnique({
      where: { id: parsed.deposito_id },
    });
    if (!deposito) throw new Error("Depósito no encontrado");

    const recepciones = await tx.recepcionCompra.findMany({
      where: { orden_compra_id: oc.id },
      include: { items: true },
      orderBy: { created_at: "asc" },
    });
    if (recepciones.length === 0) throw new Error("No existe recepción para esta OC");

    // Se procesan TODAS las recepciones de la OC (soporta recepción parcial:
    // OC 10 → REC 5 + REC 5). Cada recepción genera su propio ingreso a stock.
    let primerIngresoId: string | null = null;
    let procesadas = 0;

    for (const recepcion of recepciones) {
      const yaIngresada = await tx.ingresoStockCompra.findFirst({
        where: { recepcion_id: recepcion.id },
      });
      if (yaIngresada) continue;

      const numero = await getNextIngresoNumber(tx);
      const ingreso = await tx.ingresoStockCompra.create({
        data: {
          numero_ingreso: numero,
          recepcion_id: recepcion.id,
          deposito_id: deposito.id,
          usuario_ingreso_id: usuario.id,
          estado: "completado",
          observaciones: `Ingreso de ${oc.numero_orden ?? "OC"} - ${oc.proveedor?.supplier ?? "proveedor"}`,
        },
      });
      if (primerIngresoId === null) primerIngresoId = ingreso.id;

      // P4: orden estable por producto_id → locks FOR UPDATE deterministas
        const itemsOrdenados = [...recepcion.items].sort((a, b) =>
          a.producto_id.localeCompare(b.producto_id),
        );
        for (const item of itemsOrdenados) {
          if (item.cantidad_recibida <= 0) continue;
        await tx.ingresoStockCompraItem.create({
          data: {
            ingreso_id: ingreso.id,
            producto_id: item.producto_id,
            recepcion_item_id: item.id,
            cantidad: item.cantidad_recibida,
          },
        });

        const resultado = await incrementarStockDeposito(
          tx,
          item.producto_id,
          deposito.id,
          item.cantidad_recibida,
        );

        const producto = await tx.producto.findUnique({ where: { id: item.producto_id } });

        await tx.movimientoInventario.create({
          data: {
            tipo: "entrada",
            producto_id: item.producto_id,
            producto_nombre: producto?.nombre ?? null,
            producto_codigo: producto?.codigo ?? null,
            cantidad: item.cantidad_recibida,
            stock_anterior: resultado.total_anterior,
            stock_nuevo: resultado.total_nuevo,
            deposito_destino: deposito.nombre,
            referencia: oc.numero_orden ?? null,
            motivo: "Recepcion de compra",
            usuario_nombre: usuario.nombre ?? "Admin",
          },
        });
      }

      await tx.recepcionCompra.update({
        where: { id: recepcion.id },
        data: { estado: "aprobada" },
      });
      procesadas++;
    }

    if (procesadas === 0) {
      throw new Error("Todas las recepciones de esta OC ya fueron ingresadas a stock");
    }

    await tx.ordenesCompra.update({
      where: { id: oc.id },
      data: { estado: "ingresada" },
    });

    return { id: primerIngresoId ?? oc.id, oc_id: oc.id };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Pagos a proveedores
// ────────────────────────────────────────────────────────────────────────────

const CUENTA_CXP_CODE = "2.1.01";
const CUENTA_COMPRAS_CODE = "6.1.01";
const CUENTA_BANCOS_CODE = "1.1.02";

export async function getPagosProveedor(): Promise<PagoProveedorDTO[]> {
  const rows = await prisma.pagoProveedor.findMany({
    include: {
      proveedor: { select: { supplier: true } },
      ordenCompra: { select: { numero_orden: true } },
    },
    orderBy: [{ fecha_pago: { sort: "desc", nulls: "last" } }, { created_at: "desc" }],
    take: 1000,
  });
  return rows.map((r) => ({
    id: r.id,
    oc_id: r.orden_compra_id,
    oc_numero: r.ordenCompra?.numero_orden ?? null,
    proveedor_nombre: r.proveedor?.supplier ?? null,
    monto: Number(r.monto ?? 0),
    metodo_pago: r.metodo_pago,
    numero_factura: r.invoice_number,
    referencia: r.referencia,
    fecha_pago: r.fecha_pago?.toISOString().split("T")[0] ?? null,
    created_at: r.created_at.toISOString(),
  }));
}

export async function getMetodosPago(): Promise<
  { id: string; nombre: string }[]
> {
  const rows = await prisma.metodoPago.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map((m) => ({ id: m.id, nombre: m.nombre }));
}

export async function getCuentasPagarVentana(): Promise<CuentaPagarDTO[]> {
  const rows = await prisma.cuentaPagar.findMany({
    include: {
      proveedor: { select: { supplier: true } },
      ordenCompra: { select: { numero_orden: true } },
    },
    orderBy: [{ fecha_vencimiento: { sort: "asc", nulls: "last" } }],
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    oc_id: r.orden_compra_id,
    proveedor_nombre: r.proveedor.supplier ?? "—",
    oc_numero: r.ordenCompra?.numero_orden ?? null,
    monto_total: Number(r.monto_total),
    saldo_pendiente: Number(r.saldo_pendiente),
    estado: r.estado as string,
    fecha_vencimiento: r.fecha_vencimiento?.toISOString().split("T")[0] ?? null,
  }));
}

export async function registrarPagoProveedor(
  input: RegistrarPagoProveedorInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = registrarPagoProveedorSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    // Lock de la OC: serializa pagos concurrentes; la segunda relee el saldo
    // ya descontado y rechaza si el monto supera el saldo restante.
    await bloquearFila(tx, "orden_compra", parsed.oc_id);
    const oc = await tx.ordenesCompra.findUnique({
      where: { id: parsed.oc_id },
      include: { proveedor: true },
    });
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estado === "cancelada") {
      throw new Error("No se puede pagar una OC cancelada");
    }
    if (!oc.proveedor_id) throw new Error("La OC no tiene proveedor");

    const cp = await tx.cuentaPagar.findFirst({
      where: { orden_compra_id: oc.id },
    });
    if (!cp) {
      throw new Error("La OC no tiene cuenta por pagar: envíala primero para registrar pagos");
    }
    const saldo = Number(cp.saldo_pendiente);
    const errSaldo = errorPagoSuperaSaldo({ monto: parsed.monto, saldo });
    if (errSaldo) throw new Error(errSaldo);

    const pago = await tx.pagoProveedor.create({
      data: {
        orden_compra_id: oc.id,
        proveedor_id: oc.proveedor_id,
        monto: parsed.monto,
        metodo_pago: parsed.metodo_pago,
        fecha_pago: new Date(),
        referencia: parsed.referencia || null,
        invoice_number: parsed.numero_factura || null,
        creator: usuario.id,
      },
    });

    const nuevoSaldo = Number(cp.saldo_pendiente) - parsed.monto;
    await tx.cuentaPagar.update({
      where: { id: cp.id },
      data: {
        saldo_pendiente: nuevoSaldo,
        estado: nuevoSaldo <= 0 ? "pagado" : "parcial",
      },
    });

    await crearAsientoPagoProveedor(tx, {
      numero_oc: oc.numero_orden ?? "OC",
      proveedorNombre: oc.proveedor?.supplier ?? null,
      monto: parsed.monto,
      referenciaId: pago.id,
    });

    return pago.id;
  });
}

async function crearAsientoPagoProveedor(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: { numero_oc: string; proveedorNombre: string | null; monto: number; referenciaId: string },
): Promise<void> {
  const caja = await tx.planCuenta.findUnique({ where: { codigo: CUENTA_BANCOS_CODE } })
    ?? await tx.planCuenta.findUnique({ where: { codigo: "1.1.01" } });
  const cxp = await tx.planCuenta.findUnique({ where: { codigo: CUENTA_CXP_CODE } });
  const compras = await tx.planCuenta.findUnique({ where: { codigo: CUENTA_COMPRAS_CODE } });
  // P4: fail explícito — un pago registrado sin asiento rompe la contabilidad.
  if (!caja) {
    throw new Error(
      `Cuenta de caja/bancos (${CUENTA_BANCOS_CODE} / 1.1.01) no encontrada en el plan de cuentas`,
    );
  }
  const contraparte = cxp ?? compras;
  if (!contraparte) {
    throw new Error(
      `Cuenta de CxP/Compras (${CUENTA_CXP_CODE} / ${CUENTA_COMPRAS_CODE}) no encontrada en el plan de cuentas`,
    );
  }

  const numero = await getNextAsientoNumberTx(tx);
  const proveedor = opts.proveedorNombre ? `${opts.proveedorNombre} - ` : "";

  const lineas = [
    { cuenta: contraparte.id, debe: opts.monto, haber: 0 },
    { cuenta: caja.id, debe: 0, haber: opts.monto },
  ];
  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
  if (totalDebe !== totalHaber) {
    throw new Error(
      "El asiento de pago a proveedor no cuadra (partida doble)",
    );
  }

  const asiento = await tx.asientoContable.create({
    data: {
      numero_asiento: numero,
      fecha: new Date(),
      concepto: `Pago a proveedor ${opts.numero_oc} - ${proveedor}₲${opts.monto.toLocaleString()}`,
      referencia_tipo: "pago_proveedor",
      referencia_id: opts.referenciaId,
      estado: "contabilizado",
    },
  });

  await tx.asientoContableDetalle.createMany({
    data: lineas.map((l) => ({
      asiento_id: asiento.id,
      cuenta_id: l.cuenta,
      debe: l.debe,
      haber: l.haber,
    })),
  });
}

async function getNextAsientoNumberTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "AS",
    year,
    await getNextNumero(tx, "asiento", year),
  );
}

export async function anularPagoProveedor(id: string, motivo: string): Promise<void> {
  if (!motivo?.trim()) throw new Error("El motivo es obligatorio");

  return prisma.$transaction(async (tx) => {
    // Lock del pago: una doble anulación concurrente serializa y la segunda
    // no encuentra el pago (ya eliminado) → rechazo, no doble reversión.
    const pago = await bloquearFila<{
      id: string;
      monto: number | null;
      orden_compra_id: string | null;
    }>(tx, "pago_proveedor", id);
    if (!pago) throw new Error("Pago no encontrado");

    const cp = await tx.cuentaPagar.findFirst({
      where: { orden_compra_id: pago.orden_compra_id ?? "" },
    });
    if (cp) {
      const nuevoSaldo = Number(cp.saldo_pendiente) + Number(pago.monto ?? 0);
      await tx.cuentaPagar.update({
        where: { id: cp.id },
        data: {
          saldo_pendiente: nuevoSaldo,
          estado: nuevoSaldo >= Number(cp.monto_total) ? "pendiente" : "parcial",
        },
      });
    }

    // Se cancela el asiento contable del pago original (partida doble en balance):
    // al anular el pago, el asiento deja de ser 'contabilizado'.
    const asiento = await tx.asientoContable.findFirst({
      where: {
        referencia_tipo: "pago_proveedor",
        referencia_id: pago.id,
      },
    });
    if (asiento) {
      await tx.asientoContable.update({
        where: { id: asiento.id },
        data: {
          estado: "cancelado",
          concepto: `[ANULADO] ${asiento.concepto}`,
          updated_at: new Date(),
        },
      });
    }

    await tx.pagoProveedor.delete({ where: { id } });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Resumen para el índice
// ────────────────────────────────────────────────────────────────────────────

export async function getResumenCompras(): Promise<ResumenComprasDTO> {
  const [totalProveedores, ocs, cpPendiente] = await Promise.all([
    prisma.proveedor.count(),
    prisma.ordenesCompra.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.cuentaPagar.aggregate({
      where: { estado: { in: ["pendiente", "parcial"] } },
      _sum: { saldo_pendiente: true },
    }),
  ]);

  const count = (estado: string) =>
    ocs.find((g) => g.estado === estado)?._count._all ?? 0;

  return {
    total_proveedores: totalProveedores,
    ocs_borrador: count("borrador"),
    ocs_pendientes:
      count("pendiente_aprobacion") +
      count("aprobada") +
      count("enviada") +
      count("recepcion_parcial") +
      count("pendiente_ingreso_stock"),
    ocs_ingresadas: count("ingresada"),
    ocs_canceladas: count("cancelada"),
    total_cp_pendiente: Number(cpPendiente._sum.saldo_pendiente ?? 0),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Búsqueda por barcode (determinista)
// ────────────────────────────────────────────────────────────────────────────

export interface ProductoBarcodeDTO {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio_base: number;
  purchase_cost: number;
}

/**
 * Búsqueda por barcode SIN unique en DB (ver AUDITORIA_FASE7.md §6.6):
 * devuelve TODAS las coincidencias con orden determinista
 * (`created_at asc, id asc`). La capa de acción decide la política:
 * 0 → null, 1 → producto único, N → conflicto exigible al usuario.
 */
export async function buscarProductosPorBarcode(
  barcode: string,
): Promise<ProductoBarcodeDTO[]> {
  const rows = await prisma.producto.findMany({
    where: { barcode },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      codigo: true,
      nombre: true,
      descripcion: true,
      precio_base: true,
      purchase_cost: true,
    },
  });
  return rows.map((p) => ({
    id: p.id,
    codigo: p.codigo ?? "",
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    precio_base: Number(p.precio_base ?? 0),
    purchase_cost: Number(p.purchase_cost ?? 0),
  }));
}