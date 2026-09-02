import "server-only";
import { prisma } from "@/lib/prisma";
import {
  crearMetodoPagoSchema,
  actualizarMetodoPagoSchema,
  type ActualizarConfiguracionInput,
  type CrearMetodoPagoInput,
  type ActualizarMetodoPagoInput,
} from "@/lib/configuracion/schema";

export interface ConfiguracionDTO {
  costo_operativo_global: number;
  porcentaje_comision_vendedor: number;
  tipo_cambio_usd: number;
  texto_base_certificado: string;
  condiciones_generales: string;
  membrete_texto: string;
  logo_url: string | null;
  email_contacto: string;
  telefono_contacto: string;
  ultima_modificacion: string | null;
  modificado_por: string | null;
}

export async function getConfiguracion(): Promise<ConfiguracionDTO> {
  const row = await prisma.configuracionSistema.findFirst();
  return {
    costo_operativo_global: Number(row?.costo_operativo_global ?? 0),
    porcentaje_comision_vendedor: Number(
      row?.porcentaje_comision_vendedor ?? 0,
    ),
    tipo_cambio_usd: Number(row?.tipo_cambio_usd ?? 7500),
    texto_base_certificado: row?.texto_base_certificado ?? "",
    condiciones_generales: row?.condiciones_generales ?? "",
    membrete_texto: row?.membrete_texto ?? "",
    logo_url: row?.logo_url ?? null,
    email_contacto: row?.email_contacto ?? "",
    telefono_contacto: row?.telefono_contacto ?? "",
    ultima_modificacion:
      row?.ultima_modificacion?.toISOString() ?? null,
    modificado_por: row?.modificado_por ?? null,
  };
}

export async function actualizarConfiguracion(
  data: ActualizarConfiguracionInput,
  usuarioId: string,
): Promise<void> {
  const existing = await prisma.configuracionSistema.findFirst();
  const valores = {
    costo_operativo_global: data.costo_operativo_global,
    porcentaje_comision_vendedor: data.porcentaje_comision_vendedor,
    tipo_cambio_usd: data.tipo_cambio_usd,
    texto_base_certificado: data.texto_base_certificado,
    condiciones_generales: data.condiciones_generales,
    membrete_texto: data.membrete_texto,
    logo_url: data.logo_url || null,
    email_contacto: data.email_contacto,
    telefono_contacto: data.telefono_contacto,
    ultima_modificacion: new Date(),
    modificado_por: usuarioId,
  };

  if (existing) {
    await prisma.configuracionSistema.update({
      where: { id: existing.id },
      data: valores,
    });
  } else {
    await prisma.configuracionSistema.create({
      data: valores as {
        costo_operativo_global?: number;
        porcentaje_comision_vendedor?: number;
        tipo_cambio_usd?: number;
        texto_base_certificado?: string;
        condiciones_generales?: string;
        membrete_texto?: string;
        logo_url?: string | null;
        email_contacto?: string;
        telefono_contacto?: string;
        ultima_modificacion?: Date;
        modificado_por?: string;
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Métodos de pago (CRUD)
// ────────────────────────────────────────────────────────────────────────────

export interface MetodoPagoDTO {
  id: string;
  nombre: string;
  porcentaje_costo: number;
  activo: boolean;
  created_at: string;
}

export async function getMetodosPagoConfig(): Promise<MetodoPagoDTO[]> {
  const rows = await prisma.metodoPago.findMany({
    orderBy: { nombre: "asc" },
    take: 500,
  });
  return rows.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    porcentaje_costo: Number(m.porcentaje_costo ?? 0),
    activo: m.activo ?? true,
    created_at: m.created_at.toISOString(),
  }));
}

export async function crearMetodoPago(data: CrearMetodoPagoInput): Promise<string> {
  const parsed = crearMetodoPagoSchema.parse(data);
  const existente = await prisma.metodoPago.findFirst({
    where: { nombre: parsed.nombre },
  });
  if (existente) {
    throw new Error(`Ya existe un método de pago llamado "${parsed.nombre}"`);
  }
  const m = await prisma.metodoPago.create({
    data: {
      nombre: parsed.nombre,
      porcentaje_costo: parsed.porcentaje_costo ?? 0,
      activo: parsed.activo ?? true,
    },
  });
  return m.id;
}

export async function actualizarMetodoPago(
  id: string,
  data: ActualizarMetodoPagoInput,
): Promise<void> {
  const parsed = actualizarMetodoPagoSchema.parse(data);
  const patch: Record<string, unknown> = {};
  if (parsed.nombre !== undefined) {
    const existente = await prisma.metodoPago.findFirst({
      where: { nombre: parsed.nombre, NOT: { id } },
    });
    if (existente) {
      throw new Error(`Ya existe un método de pago llamado "${parsed.nombre}"`);
    }
    patch.nombre = parsed.nombre;
  }
  if (parsed.porcentaje_costo !== undefined)
    patch.porcentaje_costo = parsed.porcentaje_costo;
  if (parsed.activo !== undefined) patch.activo = parsed.activo;
  await prisma.metodoPago.update({ where: { id }, data: patch });
}

export async function eliminarMetodoPago(id: string): Promise<void> {
  await prisma.metodoPago.delete({ where: { id } });
}
