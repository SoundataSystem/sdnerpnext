export const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "vendedor", label: "Vendedor" },
  { value: "cajero", label: "Cajero" },
  { value: "contabilidad", label: "Contabilidad" },
  { value: "compra", label: "Compras" },
  { value: "administracion", label: "Administración" },
  { value: "logistica", label: "Logística" },
  { value: "deposito", label: "Depósito" },
  { value: "servicio_tecnico", label: "Servicio técnico" },
  { value: "supervisor_tecnico", label: "Supervisor técnico" },
  { value: "chofer", label: "Chofer" },
  { value: "nominal", label: "Nominal" },
  { value: "recepcion_compras", label: "Recepción de compras" },
] as const;

export type Rol = (typeof ROLES)[number]["value"];

/** Conjunto de roles válidos según el catálogo. */
export const ROLES_VALIDOS = new Set<string>(ROLES.map((r) => r.value));

/**
 * RBAC puro: verifica si el rol del usuario está dentro de los permitidos.
 * Se usa en requireRole (Server Actions) y getRoleOrRedirect (páginas).
 */
export function rolesPermiten(rol: string, permitidos: readonly string[]): boolean {
  return permitidos.includes(rol);
}

/** Valida que la lista de roles permitidos exista en el catálogo. */
export function rolesExisten(permitidos: readonly string[]): string[] {
  return permitidos.filter((r) => !ROLES_VALIDOS.has(r));
}
