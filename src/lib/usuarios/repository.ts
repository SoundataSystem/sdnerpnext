import "server-only";
import { prisma } from "@/lib/prisma";
import { getAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import type {
  ActualizarUsuarioInput,
  CrearUsuarioInput,
} from "@/lib/usuarios/schema";

export interface UsuarioDTO {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  telefono: string | null;
  activo: boolean | null;
  vendedor_codigo: string | null;
  auth_user_id: string | null;
  created_at: string;
  ordenes_count: number;
}

export async function getUsuarios(): Promise<UsuarioDTO[]> {
  const rows = await prisma.usuario.findMany({
    include: { _count: { select: { ordenesVendidas: true } } },
    orderBy: { created_at: "desc" },
  });
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    apellido: u.apellido,
    rol: u.rol,
    telefono: u.telefono,
    activo: u.activo,
    vendedor_codigo: u.vendedor_codigo,
    auth_user_id: u.auth_user_id,
    created_at: u.created_at.toISOString(),
    ordenes_count: u._count.ordenesVendidas,
  }));
}

export async function crearUsuario(data: CrearUsuarioInput): Promise<string> {
  if (!isServiceRoleConfigured()) {
    throw new Error(
      "No se puede crear el usuario de login: SUPABASE_SERVICE_ROLE_KEY no está configurada en .env. Podés crear el usuario manualmente en la consola de Supabase y vincularlo con la opción 'Vincular'.",
    );
  }

  const supabase = getAdminClient();
  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      nombre: data.nombre,
      apellido: data.apellido,
      rol: data.rol,
    },
  });
  if (error) throw new Error(error.message);
  if (!authUser.user) throw new Error("No se pudo crear el usuario de auth");

  const usuario = await prisma.usuario.create({
    data: {
      email: data.email,
      nombre: data.nombre,
      apellido: data.apellido,
      rol: data.rol,
      telefono: data.telefono || null,
      vendedor_codigo: data.vendedor_codigo || null,
      auth_user_id: authUser.user.id,
    },
  });
  return usuario.id;
}

export async function actualizarUsuario(
  id: string,
  data: ActualizarUsuarioInput,
): Promise<void> {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new Error("Usuario no encontrado");

  const { password, ...rest } = data;
  await prisma.usuario.update({
    where: { id },
    data: {
      ...rest,
      email: rest.email ?? undefined,
      telefono: rest.telefono !== undefined ? rest.telefono || null : undefined,
      vendedor_codigo:
        rest.vendedor_codigo !== undefined
          ? rest.vendedor_codigo || null
          : undefined,
    },
  });

  if (password && usuario.auth_user_id && isServiceRoleConfigured()) {
    const supabase = getAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(
      usuario.auth_user_id,
      { password },
    );
    if (error) throw new Error(error.message);
  }
}

export async function cambiarEstadoUsuario(
  id: string,
  activo: boolean,
): Promise<void> {
  await prisma.usuario.update({ where: { id }, data: { activo } });
}

export async function vincularAuthUser(
  usuarioId: string,
  authUserId: string,
): Promise<void> {
  const existente = await prisma.usuario.findFirst({
    where: { auth_user_id: authUserId },
  });
  if (existente && existente.id !== usuarioId) {
    throw new Error(
      "Ese auth_user_id ya está vinculado a otro usuario del sistema",
    );
  }
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { auth_user_id: authUserId },
  });
}
