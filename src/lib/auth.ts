import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import { rolesPermiten } from "@/lib/usuarios/roles";
import {
  verificarPermiso,
  verificarAlgunPermiso,
  verificarTodosPermisos,
} from "@/lib/auth/permisos";

/**
 * Retorna la sesión de Supabase actual (user de auth).
 * Se cachea por request para evitar llamadas duplicadas.
 */
export const getSession = cache(async () => {
  // Si las env vars no están, evitamos un crash en runtime
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[auth] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no configuradas");
    return null;
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Middleware ya refresca la sesión; aquí solo lectura
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export type AuthUser = {
  id: string;
  email: string;
};

export type SessionProfile = {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  telefono: string | null;
  vendedor_codigo: string | null;
  activo: boolean | null;
};

/**
 * Devuelve el perfil completo del usuario (tabla `usuarios`)
 * enlazado con su sesión de Supabase (auth_user_id).
 */
export const getCurrentUser = cache(
  async (): Promise<SessionProfile | null> => {
    const user = await getSession();
    if (!user) return null;

    const profile = await prisma.usuario.findUnique({
      where: { auth_user_id: user.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        telefono: true,
        vendedor_codigo: true,
        activo: true,
      },
    });

    if (!profile || profile.activo === false) return null;

    return profile;
  },
);

/**
 * Lanza error si no hay sesión activa. Para Server Actions y RSC protegidos.
 */
export async function requireUser(): Promise<SessionProfile> {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("No autorizado: sesión inválida o expirada");
  }
  return profile;
}

/**
 * RBAC en servidor. Verifica que el rol del usuario esté permitido.
 * Se usa como guard dentro de las Server Actions.
 */
export async function requireRole(...roles: string[]): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!rolesPermiten(profile.rol, roles)) {
    throw new Error(`Acceso denegado: se requiere rol ${roles.join(" o ")}`);
  }
  return profile;
}

/**
 * Verifica un permiso específico (recurso:acción) en lugar de rol.
 * Nueva API recomendada para control granular.
 */
export async function requirePermiso(
  recurso: import("@/lib/auth/permisos").Recurso,
  accion: import("@/lib/auth/permisos").Accion,
): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!verificarPermiso(profile.rol, recurso, accion)) {
    throw new Error(`Acceso denegado: se requiere permiso ${recurso}:${accion}`);
  }
  return profile;
}

/**
 * Requiere AL MENOS uno de los permisos (OR lógico).
 */
export async function requireAlgunPermiso(
  recurso: import("@/lib/auth/permisos").Recurso,
  ...acciones: import("@/lib/auth/permisos").Accion[]
): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!verificarAlgunPermiso(profile.rol, recurso, acciones)) {
    throw new Error(`Acceso denegado: se requiere ${recurso}:${acciones.join(" o ")}`);
  }
  return profile;
}

/**
 * Requiere TODOS los permisos (AND lógico).
 */
export async function requireTodosPermisos(
  recurso: import("@/lib/auth/permisos").Recurso,
  ...acciones: import("@/lib/auth/permisos").Accion[]
): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!verificarTodosPermisos(profile.rol, recurso, acciones)) {
    throw new Error(`Acceso denegado: se requieren ${recurso}:${acciones.join(", ")}`);
  }
  return profile;
}
