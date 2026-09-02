import "server-only";
import { prisma } from "@/lib/prisma";
import type { Rol } from "@/generated/prisma/client";

export interface NotificacionDTO {
  id: string;
  tipo_evento: string;
  titulo: string;
  mensaje: string | null;
  entidad: string | null;
  entidad_id: string | null;
  leida: boolean;
  created_at: string;
}

export async function getNotificaciones(
  usuarioId: string,
  page = 1,
  pageSize = 25,
): Promise<{
  items: NotificacionDTO[];
  no_leidas: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const p = Math.max(1, Math.trunc(page));
  const size = Math.max(1, Math.trunc(pageSize));
  const where = { usuario_id: usuarioId };
  const [rows, total, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (p - 1) * size,
      take: size,
    }),
    prisma.notificacion.count({ where }),
    prisma.notificacion.count({ where: { ...where, leida: false } }),
  ]);
  return {
    items: rows.map((n) => ({
      id: n.id,
      tipo_evento: n.tipo_evento,
      titulo: n.titulo,
      mensaje: n.mensaje,
      entidad: n.entidad,
      entidad_id: n.entidad_id,
      leida: n.leida,
      created_at: n.created_at.toISOString(),
    })),
    no_leidas: noLeidas,
    total,
    page: p,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(total / size)),
  };
}

export async function crearNotificacionParaUsuario(params: {
  usuario_id: string;
  tipo_evento: string;
  titulo: string;
  mensaje?: string;
  entidad?: string;
  entidad_id?: string;
}): Promise<void> {
  await prisma.notificacion.create({
    data: {
      usuario_id: params.usuario_id,
      tipo_evento: params.tipo_evento,
      titulo: params.titulo,
      mensaje: params.mensaje ?? null,
      entidad: params.entidad ?? null,
      entidad_id: params.entidad_id ?? null,
      leida: false,
    },
  });
}

export async function crearNotificacionParaRoles(params: {
  roles: string[];
  tipo_evento: string;
  titulo: string;
  mensaje?: string;
  entidad?: string;
  entidad_id?: string;
  excepto_usuario_id?: string;
}): Promise<void> {
  const usuarios = await prisma.usuario.findMany({
    where: {
      rol: { in: params.roles as Rol[] },
      activo: true,
      ...(params.excepto_usuario_id
        ? { id: { not: params.excepto_usuario_id } }
        : {}),
    },
    select: { id: true },
  });
  if (usuarios.length === 0) return;
  await prisma.notificacion.createMany({
    data: usuarios.map((u) => ({
      usuario_id: u.id,
      tipo_evento: params.tipo_evento,
      titulo: params.titulo,
      mensaje: params.mensaje ?? null,
      entidad: params.entidad ?? null,
      entidad_id: params.entidad_id ?? null,
    })),
  });
}

export async function marcarNotificacionLeida(
  id: string,
  usuarioId: string,
): Promise<void> {
  await prisma.notificacion.updateMany({
    where: { id, usuario_id: usuarioId },
    data: { leida: true },
  });
}

export async function marcarTodasLeidas(usuarioId: string): Promise<void> {
  await prisma.notificacion.updateMany({
    where: { usuario_id: usuarioId, leida: false },
    data: { leida: true },
  });
}
