/**
 * Helpers de autenticación para Server Components y páginas.
 *
 * En lugar de lanzar excepciones (requireUser / requireRole) que burbujean
 * hasta el error boundary, estos helpers usan `redirect()` para enviar al
 * usuario a /login cuando no tiene sesión o no tiene el rol requerido.
 *
 * ÚSALOS en pages y layouts.
 * Seguí usando requireUser / requireRole dentro de Server Actions.
 */
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionProfile } from "@/lib/auth";
import { rolesPermiten } from "@/lib/usuarios/roles";

/**
 * Devuelve el perfil del usuario autenticado.
 * Si no hay sesión activa, redirige a /login.
 */
export async function getAuthOrRedirect(): Promise<SessionProfile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Devuelve el perfil del usuario autenticado y verifica que tenga uno de los
 * roles indicados. Si no hay sesión redirige a /login; si no tiene el rol
 * redirige a / (dashboard).
 */
export async function getRoleOrRedirect(
  ...roles: string[]
): Promise<SessionProfile> {
  const user = await getAuthOrRedirect();
  if (!rolesPermiten(user.rol, roles)) redirect("/");
  return user;
}
