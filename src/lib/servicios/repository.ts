import "server-only";
import { prisma } from "@/lib/prisma";
import { bloquearFila } from "@/lib/prisma/locks";
import type {
  Producto,
  EstadoOrdenServicio,
  EstadoInstalacion,
  EstadoTicket,
} from "@/generated/prisma/client";
import {
  crearTecnicoSchema,
  actualizarTecnicoSchema,
  crearOrdenServicioSchema,
  crearInstalacionSchema,
  registrarGarantiaSchema,
  crearTicketSchema,
  crearRmaSchema,
  avanzarRmaSchema,
  type CrearTecnicoInput,
  type CrearOrdenServicioInput,
  type CrearInstalacionInput,
  type RegistrarGarantiaInput,
  type CrearTicketInput,
  type CrearRmaInput,
  type AvanzarRmaInput,
} from "@/lib/servicios/schema";
import { calcularCostoTotal } from "@/lib/servicios/calculos";
import { getNextGarantiaNumber } from "@/lib/servicios/numeracion";
import { validarSerialAsociado } from "@/lib/servicios/series";
import {
  formatearNumero,
  getNextNumero as siguienteNumero,
} from "@/lib/numeracion";
import {
  siguienteEstadoRma,
  esEstadoRmaFinal,
} from "@/lib/servicios/maquina-estados";

// ────────────────────────────────────────────────────────────────────────────
// DTOs
// ────────────────────────────────────────────────────────────────────────────

export interface TecnicoDTO {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  especialidad: string | null;
  activo: boolean | null;
  ordenes_activas: number;
}

export interface OrdenServicioDTO {
  id: string;
  numero_orden: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  producto_nombre: string | null;
  tipo_servicio: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  tecnico_nombre: string | null;
  fecha_prometida: string | null;
  fecha_completado: string | null;
  costo_total: number;
  created_at: string;
}

export interface OrdenServicioDetalleDTO extends OrdenServicioDTO {
  diagnostico_tecnico: string | null;
  observaciones: string | null;
  costo_servicio: number;
  costo_repuestos: number;
}

export interface InstalacionDTO {
  id: string;
  orden_servicio_id: string | null;
  tecnico_nombre: string | null;
  fecha_programada: string;
  estado: string;
  ciudad: string | null;
  direccion: string | null;
}

export interface GarantiaDTO {
  id: string;
  codigo_garantia: string;
  orden_numero: string | null;
  producto_nombre: string | null;
  cliente_nombre: string | null;
  serial_producto: string;
  estado: string;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  numero_factura: string | null;
}

export interface TicketSoporteDTO {
  id: string;
  numero_ticket: string | null;
  asunto: string | null;
  cliente_nombre: string | null;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  created_at: string;
}

export interface RmaDTO {
  id: string;
  numero_rma: string;
  cliente_nombre: string;
  producto_nombre: string;
  serial_producto: string | null;
  tipo_rma: string;
  motivo: string;
  prioridad: string;
  estado: string;
  diagnostico: string | null;
  resultado_diagnostico: string | null;
  resolucion: string | null;
  created_at: string;
}

export interface ResumenServiciosDTO {
  ordenes_pendientes: number;
  ordenes_en_progreso: number;
  instalaciones_programadas: number;
  garantias_validadas: number;
  tickets_abiertos: number;
  rmas_pendientes: number;
  tecnicos_activos: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function getNextNumero(
  caller: { $queryRaw<U>(q: TemplateStringsArray, ...v: unknown[]): Promise<U> },
  tipo: "orden_servicio" | "rma",
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    prefix,
    year,
    await siguienteNumero(caller, tipo, year),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Técnicos
// ────────────────────────────────────────────────────────────────────────────

export async function getTecnicos(): Promise<TecnicoDTO[]> {
  const rows = await prisma.tecnico.findMany({
    include: { _count: { select: { ordenesServicio: true } } },
    orderBy: [{ nombre: "asc" }],
  });
  return rows.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    telefono: t.telefono,
    email: t.email,
    especialidad: t.especialidad,
    activo: t.activo,
    ordenes_activas: t._count.ordenesServicio,
  }));
}

export async function crearTecnico(data: CrearTecnicoInput): Promise<string> {
  const parsed = crearTecnicoSchema.parse(data);
  const row = await prisma.tecnico.create({
    data: {
      nombre: parsed.nombre,
      telefono: parsed.telefono || null,
      email: parsed.email || null,
      especialidad: parsed.especialidad || null,
      activo: true,
    },
  });
  return row.id;
}

export async function actualizarTecnico(
  id: string,
  data: { nombre?: string; telefono?: string; email?: string; especialidad?: string },
): Promise<void> {
  const parsed = actualizarTecnicoSchema.parse(data);
  await prisma.tecnico.update({
    where: { id },
    data: {
      nombre: parsed.nombre,
      telefono: parsed.telefono || null,
      email: parsed.email || null,
      especialidad: parsed.especialidad || null,
    },
  });
}

export async function cambiarEstadoTecnico(id: string): Promise<void> {
  const row = await prisma.tecnico.findUnique({ where: { id } });
  if (!row) throw new Error("Técnico no encontrado");
  await prisma.tecnico.update({
    where: { id },
    data: { activo: !(row.activo ?? true) },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Órdenes de servicio
// ────────────────────────────────────────────────────────────────────────────

export async function getOrdenesServicio(filtro?: {
  estado?: string;
  busqueda?: string;
}): Promise<OrdenServicioDTO[]> {
  const rows = await prisma.ordenServicio.findMany({
    where:
      filtro?.estado && filtro.estado !== "todos"
        ? { estado: filtro.estado as EstadoOrdenServicio }
        : undefined,
    include: { cliente: true, producto: true, tecnico: true },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });

  const mapped: OrdenServicioDTO[] = rows.map((o) => ({
    id: o.id,
    numero_orden: o.numero_orden,
    cliente_nombre: o.cliente_nombre ?? o.cliente?.nombre ?? null,
    cliente_telefono: o.cliente_telefono ?? o.cliente?.telefono ?? null,
    producto_nombre: o.producto_nombre ?? o.producto?.nombre ?? null,
    tipo_servicio: o.tipo_servicio,
    descripcion: o.descripcion,
    estado: o.estado,
    prioridad: o.prioridad,
    tecnico_nombre: o.tecnico?.nombre ?? null,
    fecha_prometida: o.fecha_prometida?.toISOString().split("T")[0] ?? null,
    fecha_completado: o.fecha_completado?.toISOString() ?? null,
    costo_total: Number(o.costo_total ?? 0),
    created_at: (o.created_at ?? o.fecha_ingreso)?.toISOString() ?? new Date().toISOString(),
  }));

  if (filtro?.busqueda?.trim()) {
    const q = filtro.busqueda.toLowerCase();
    return mapped.filter(
      (o) =>
        o.numero_orden.toLowerCase().includes(q) ||
        o.cliente_nombre?.toLowerCase().includes(q) ||
        o.producto_nombre?.toLowerCase().includes(q),
    );
  }
  return mapped;
}

export async function getOrdenServicio(
  id: string,
): Promise<OrdenServicioDetalleDTO | null> {
  const o = await prisma.ordenServicio.findUnique({
    where: { id },
    include: { cliente: true, producto: true, tecnico: true },
  });
  if (!o) return null;
  return {
    id: o.id,
    numero_orden: o.numero_orden,
    cliente_nombre: o.cliente_nombre ?? o.cliente?.nombre ?? null,
    cliente_telefono: o.cliente_telefono ?? o.cliente?.telefono ?? null,
    producto_nombre: o.producto_nombre ?? o.producto?.nombre ?? null,
    tipo_servicio: o.tipo_servicio,
    descripcion: o.descripcion,
    estado: o.estado,
    prioridad: o.prioridad,
    tecnico_nombre: o.tecnico?.nombre ?? null,
    fecha_prometida: o.fecha_prometida?.toISOString().split("T")[0] ?? null,
    fecha_completado: o.fecha_completado?.toISOString() ?? null,
    costo_total: Number(o.costo_total ?? 0),
    created_at:
      (o.created_at ?? o.fecha_ingreso)?.toISOString() ?? new Date().toISOString(),
    diagnostico_tecnico: o.diagnostico_tecnico,
    observaciones: o.observaciones,
    costo_servicio: Number(o.costo_servicio ?? 0),
    costo_repuestos: Number(o.costo_repuestos ?? 0),
  };
}

export async function crearOrdenServicio(
  data: CrearOrdenServicioInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = crearOrdenServicioSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({
      where: { id: parsed.cliente_id },
    });
    if (!cliente) throw new Error("Cliente no encontrado");

    let producto: Producto | null = null;
    if (parsed.producto_id) {
      producto = await tx.producto.findUnique({
        where: { id: parsed.producto_id },
      });
      if (!producto) throw new Error("Producto no encontrado");
    }

    const numero = await getNextNumero(tx, "orden_servicio", "OS");
    const costo_total = calcularCostoTotal(
      parsed.costo_servicio,
      parsed.costo_repuestos,
    );

    const orden = await tx.ordenServicio.create({
      data: {
        numero_orden: numero,
        cliente_id: cliente.id,
        cliente_nombre: `${cliente.nombre} ${cliente.apellido ?? ""}`.trim(),
        cliente_telefono: cliente.telefono ?? null,
        producto_id: producto?.id ?? null,
        producto_nombre: producto?.nombre ?? null,
        producto_codigo: producto?.codigo ?? null,
        tipo_servicio: parsed.tipo_servicio,
        descripcion: parsed.descripcion,
        estado: "pendiente",
        prioridad: parsed.prioridad,
        tecnico_asignado: parsed.tecnico_asignado || null,
        fecha_prometida: parsed.fecha_prometida
          ? new Date(parsed.fecha_prometida)
          : null,
        costo_servicio: parsed.costo_servicio,
        costo_repuestos: parsed.costo_repuestos,
        costo_total,
        usuario_nombre: usuario.nombre,
      },
    });

    return orden.id;
  });
}

export async function cambiarEstadoOrdenServicio(
  id: string,
  estado: string,
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    // Lock: dos transiciones concurrentes se serializan; el guard de estado
    // final bloquea completar/cancelar/facturar dos veces.
    const row = await bloquearFila<{
      id: string;
      estado: string;
      fecha_completado: Date | null;
    }>(tx, "orden_servicio", id);
    if (!row) throw new Error("Orden de servicio no encontrada");
    const estadosFinales = ["completado", "cancelado", "facturado"];
    if (estadosFinales.includes(row.estado)) {
      throw new Error("La orden de servicio ya fue finalizada");
    }
    await tx.ordenServicio.update({
      where: { id },
      data: {
        estado: estado as EstadoOrdenServicio,
        fecha_completado:
          estado === "completado" ? new Date() : row.fecha_completado,
      },
    });
  });
}

export async function asignarTecnico(id: string, tecnico_id: string): Promise<void> {
  const row = await prisma.ordenServicio.findUnique({ where: { id } });
  if (!row) throw new Error("Orden de servicio no encontrada");
  const tecnico = await prisma.tecnico.findUnique({ where: { id: tecnico_id } });
  if (!tecnico) throw new Error("Técnico no encontrado");
  await prisma.ordenServicio.update({
    where: { id },
    data: { tecnico_asignado: tecnico.id },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Instalaciones
// ────────────────────────────────────────────────────────────────────────────

export async function getInstalaciones(): Promise<InstalacionDTO[]> {
  const rows = await prisma.instalacion.findMany({
    include: { tecnico: true },
    orderBy: [{ fecha_programada: "desc" }],
    take: 500,
  });
  return rows.map((i) => ({
    id: i.id,
    orden_servicio_id: i.orden_servicio_id,
    tecnico_nombre: i.tecnico?.nombre ?? null,
    fecha_programada: i.fecha_programada.toISOString().split("T")[0],
    estado: i.estado,
    ciudad: i.ciudad,
    direccion: i.direccion_instalacion,
  }));
}

export async function crearInstalacion(data: CrearInstalacionInput): Promise<string> {
  const parsed = crearInstalacionSchema.parse(data);
  const row = await prisma.instalacion.create({
    data: {
      orden_servicio_id: parsed.orden_servicio_id || null,
      tecnico_id: parsed.tecnico_id || null,
      fecha_programada: new Date(`${parsed.fecha_programada}T00:00:00`),
      hora_inicio: parsed.hora_inicio ? new Date(`1970-01-01T${parsed.hora_inicio}:00`) : null,
      hora_fin: parsed.hora_fin ? new Date(`1970-01-01T${parsed.hora_fin}:00`) : null,
      direccion_instalacion: parsed.direccion_instalacion || null,
      ciudad: parsed.ciudad || null,
      estado: "programada",
      notas: parsed.notas || null,
    },
  });
  return row.id;
}

export async function cambiarEstadoInstalacion(id: string, estado: string): Promise<void> {
  const row = await prisma.instalacion.findUnique({ where: { id } });
  if (!row) throw new Error("Instalación no encontrada");
  await prisma.instalacion.update({ where: { id }, data: { estado: estado as EstadoInstalacion } });
}

// ────────────────────────────────────────────────────────────────────────────
// Garantías
// ────────────────────────────────────────────────────────────────────────────

export async function getGarantias(): Promise<GarantiaDTO[]> {
  const rows = await prisma.garantia.findMany({
    include: { orden: true, producto: true, cliente: true },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });
  return rows.map((g) => ({
    id: g.id,
    codigo_garantia: g.codigo_garantia,
    orden_numero: g.orden?.numero_orden ?? null,
    producto_nombre: g.producto?.nombre ?? null,
    cliente_nombre: g.cliente
      ? `${g.cliente.nombre} ${g.cliente.apellido ?? ""}`.trim()
      : null,
    serial_producto: g.serial_producto,
    estado: g.estado,
    fecha_emision: g.fecha_emision?.toISOString() ?? null,
    fecha_vencimiento: g.fecha_vencimiento.toISOString().split("T")[0],
    numero_factura: g.numero_factura ?? null,
  }));
}

export async function registrarGarantia(
  data: RegistrarGarantiaInput,
): Promise<string> {
  const parsed = registrarGarantiaSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const orden = await tx.orden.findUnique({
      where: { id: parsed.orden_id },
      include: { items: true },
    });
    if (!orden) throw new Error("Orden no encontrada");
    const itemOrden = orden.items.find(
      (it) => it.id === parsed.orden_producto_id,
    );
    if (!itemOrden || itemOrden.producto_id !== parsed.producto_id) {
      throw new Error("El ítem de la orden no corresponde al producto");
    }

    // Idempotencia: una garantía por ítem de orden (misma regla que la
    // emisión automática generarGarantiasOrden).
    const existente = await tx.garantia.findUnique({
      where: { orden_producto_id: parsed.orden_producto_id },
    });
    if (existente) {
      throw new Error(
        `Ya existe una garantía (${existente.codigo_garantia}) para este ítem de la venta`,
      );
    }

    // Integridad de series: el serial de la garantía debe coincidir con el
    // vendido en la orden (evita garantías sobre un serial incorrecto).
    const serialOrden = itemOrden.serial ?? itemOrden.serial_producto;
    if (
      serialOrden?.trim() &&
      serialOrden.trim() !== parsed.serial_producto.trim()
    ) {
      throw new Error(
        `El serial no coincide con el vendido en la orden (${serialOrden.trim()})`,
      );
    }

    const codigo = await getNextGarantiaNumber(tx);
    // Etapa 1 (crear): la garantía se emite pendiente; la validación/cierre
    // (etapa 2) ocurre en validarGarantia.
    const row = await tx.garantia.create({
      data: {
        codigo_garantia: codigo,
        orden_id: orden.id,
        producto_id: parsed.producto_id,
        orden_producto_id: parsed.orden_producto_id,
        cliente_id: orden.cliente_id,
        vendedor_id: orden.vendedor_id,
        serial_producto: parsed.serial_producto,
        estado: "pendiente",
        numero_factura: parsed.numero_factura || null,
        fecha_emision: new Date(),
        fecha_vencimiento: new Date(`${parsed.fecha_vencimiento}T00:00:00`),
        condiciones_especificas: parsed.condiciones_especificas || null,
      },
    });
    return row.id;
  });
}

export async function validarGarantia(
  id: string,
  valida: boolean,
  usuario: { id: string; nombre: string },
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    // Lock: dos validaciones concurrentes se serializan; la segunda relee
    // 'validada'/'rechazada' y es rechazada.
    const row = await bloquearFila<{ id: string; estado: string }>(
      tx,
      "garantia",
      id,
    );
    if (!row) throw new Error("Garantía no encontrada");
    if (row.estado !== "pendiente" && row.estado !== "pendiente_validacion") {
      throw new Error("Solo las garantías pendientes pueden validarse");
    }
    await tx.garantia.update({
      where: { id },
      data: valida
        ? {
            estado: "validada",
            fecha_validacion: new Date(),
            validado_por: usuario.id,
          }
        : { estado: "rechazada" },
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Tickets de soporte
// ────────────────────────────────────────────────────────────────────────────

export async function getTickets(): Promise<TicketSoporteDTO[]> {
  const rows = await prisma.ticketSoporte.findMany({
    include: { cliente: true },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });
  return rows.map((t) => ({
    id: t.id,
    numero_ticket: t.numero_ticket,
    asunto: t.asunto ?? t.description ?? null,
    cliente_nombre: t.cliente
      ? `${t.cliente.nombre} ${t.cliente.apellido ?? ""}`.trim()
      : t.companyname ?? null,
    descripcion: t.descripcion ?? t.description ?? null,
    estado: t.estado ?? (t.isclosed ? "cerrado" : "pendiente"),
    prioridad: t.prioridad ?? "normal",
    created_at: t.created_at.toISOString(),
  }));
}

export async function crearTicket(
  data: CrearTicketInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = crearTicketSchema.parse(data);
  const cliente = await prisma.cliente.findUnique({
    where: { id: parsed.cliente_id },
  });
  if (!cliente) throw new Error("Cliente no encontrado");

  const numero = formatearNumero(
    "TKT",
    new Date().getFullYear(),
    await siguienteNumero(prisma, "ticket"),
  );
  const row = await prisma.ticketSoporte.create({
    data: {
      numero_ticket: numero,
      cliente_id: cliente.id,
      asunto: parsed.asunto,
      descripcion: parsed.descripcion,
      estado: "pendiente",
      prioridad: parsed.prioridad,
      opendate: new Date(),
      creator: usuario.id,
    },
  });
  return row.id;
}

export async function cambiarEstadoTicket(id: string, estado: string): Promise<void> {
  const row = await prisma.ticketSoporte.findUnique({ where: { id } });
  if (!row) throw new Error("Ticket no encontrado");
  await prisma.ticketSoporte.update({
    where: { id },
    data: {
      estado: estado as EstadoTicket,
      isclosed: estado === "cerrado" ? true : row.isclosed,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// RMA
// ────────────────────────────────────────────────────────────────────────────

export async function getRmas(): Promise<RmaDTO[]> {
  const rows = await prisma.rma.findMany({
    include: { cliente: true, producto: true },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    numero_rma: r.numero_rma,
    cliente_nombre: `${r.cliente.nombre} ${r.cliente.apellido ?? ""}`.trim(),
    producto_nombre: r.producto.nombre,
    serial_producto: r.serial_producto,
    tipo_rma: r.tipo_rma,
    motivo: r.motivo,
    prioridad: r.prioridad,
    estado: r.estado,
    diagnostico: r.diagnostico,
    resultado_diagnostico: r.resultado_diagnostico,
    resolucion: r.resolucion,
    created_at: r.created_at.toISOString(),
  }));
}

export async function crearRma(
  data: CrearRmaInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = crearRmaSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({
      where: { id: parsed.cliente_id },
    });
    if (!cliente) throw new Error("Cliente no encontrado");
    const producto = await tx.producto.findUnique({
      where: { id: parsed.producto_id },
    });
    if (!producto) throw new Error("Producto no encontrado");

    // Integridad de series: el serial del RMA debe pertenecer al producto
    // (si está registrado en productos_series para otro producto → error).
    const serial = parsed.serial_producto?.trim() || null;
    await validarSerialAsociado(tx, producto.id, serial ?? "");

    // Integridad de referencias: un RMA sobre garantía debe apuntar a una
    // garantía del mismo producto.
    if (parsed.garantia_id) {
      const garantia = await tx.garantia.findUnique({
        where: { id: parsed.garantia_id },
      });
      if (!garantia) throw new Error("Garantía no encontrada");
      if (garantia.producto_id !== producto.id) {
        throw new Error("La garantía no corresponde al producto del RMA");
      }
    }

    const numero = await getNextNumero(tx, "rma", "RMA");
    const row = await tx.rma.create({
      data: {
        numero_rma: numero,
        cliente_id: cliente.id,
        producto_id: producto.id,
        serial_producto: serial,
        tipo_rma: parsed.tipo_rma,
        motivo: parsed.motivo,
        prioridad: parsed.prioridad,
        estado: "pendiente",
        orden_id: parsed.orden_id || null,
        devolucion_venta_id: parsed.devolucion_venta_id || null,
        garantia_id: parsed.garantia_id || null,
        orden_servicio_id: parsed.orden_servicio_id || null,
        deposito_recepcion_id: parsed.deposito_recepcion_id || null,
        usuario_crea_id: usuario.id,
      },
    });
    return row.id;
  });
}

export async function avanzarRma(
  data: AvanzarRmaInput,
  usuario: { id: string; nombre: string },
): Promise<void> {
  const parsed = avanzarRmaSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    // Lock: dos avances concurrentes se serializan; el guard de estado final
    // impide cerrar/cancelar/rechazar dos veces.
    await bloquearFila<{ id: string; estado: string }>(tx, "rma", parsed.id);
    const rma = await tx.rma.findUnique({ where: { id: parsed.id } });
    if (!rma) throw new Error("RMA no encontrado");
    if (esEstadoRmaFinal(rma.estado)) {
      throw new Error("El RMA ya fue finalizado");
    }

    // Máquina de estados: solo se admiten las transiciones definidas
    // (pendiente→recibido→en_diagnostico→diagnosticado→resuelto→cerrado).
    const estado = siguienteEstadoRma(rma.estado, parsed.accion);

    if (parsed.accion === "diagnosticar" && !parsed.resultado_diagnostico) {
      throw new Error("El resultado del diagnóstico es obligatorio");
    }
    if (parsed.accion === "resolver" && !parsed.resolucion) {
      throw new Error("La resolución es obligatoria");
    }
    if (
      parsed.accion === "resolver" &&
      parsed.resolucion === "devolver_dinero" &&
      parsed.monto_reembolso <= 0
    ) {
      throw new Error("Debe indicar el monto del reembolso");
    }

    let diagnostico = rma.diagnostico;
    let resultado_diagnostico = rma.resultado_diagnostico;
    let resolucion = rma.resolucion;
    let producto_reemplazo_id = rma.producto_reemplazo_id;
    let monto_reembolso: number | null = rma.monto_reembolso
      ? Number(rma.monto_reembolso)
      : null;

    if (parsed.accion === "diagnosticar") {
      diagnostico = parsed.diagnostico || diagnostico;
      resultado_diagnostico = parsed.resultado_diagnostico ?? resultado_diagnostico;
    }
    if (parsed.accion === "resolver") {
      resolucion = parsed.resolucion ?? resolucion;
      producto_reemplazo_id = parsed.producto_reemplazo_id || producto_reemplazo_id;
      monto_reembolso = parsed.monto_reembolso > 0
        ? parsed.monto_reembolso
        : monto_reembolso;
    }

    const esCierre = ["cerrado", "cancelado", "rechazado"].includes(estado);

    await tx.rma.update({
      where: { id: parsed.id },
      data: {
        estado,
        diagnostico,
        resultado_diagnostico,
        resolucion,
        producto_reemplazo_id,
        monto_reembolso,
        observaciones: parsed.observaciones || rma.observaciones,
        usuario_responsable_id: usuario.id,
        fecha_recepcion:
          parsed.accion === "recibir" ? new Date() : rma.fecha_recepcion,
        fecha_cierre: esCierre ? new Date() : rma.fecha_cierre,
        usuario_cierra_id: esCierre ? usuario.id : rma.usuario_cierra_id,
      },
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Resumen
// ────────────────────────────────────────────────────────────────────────────

export async function getResumenServicios(): Promise<ResumenServiciosDTO> {
  const [ordenes, instalaciones, garantias, tickets, rmas, tecnicos] =
    await Promise.all([
      prisma.ordenServicio.findMany({ select: { estado: true } }),
      prisma.instalacion.findMany({ select: { estado: true } }),
      prisma.garantia.findMany({ select: { estado: true } }),
      prisma.ticketSoporte.findMany({ select: { estado: true } }),
      prisma.rma.findMany({ select: { estado: true } }),
      prisma.tecnico.findMany({ select: { activo: true } }),
    ]);

  const count = (rows: { estado: string }[], estado: string) =>
    rows.filter((r) => r.estado === estado).length;

  return {
    ordenes_pendientes: count(ordenes, "pendiente"),
    ordenes_en_progreso: count(ordenes, "en_progreso"),
    instalaciones_programadas: count(instalaciones, "programada"),
    garantias_validadas: count(garantias, "validada"),
    tickets_abiertos:
      count(tickets, "pendiente") + count(tickets, "en_curso"),
    rmas_pendientes: count(rmas, "pendiente"),
    tecnicos_activos: tecnicos.filter((t) => t.activo !== false).length,
  };
}