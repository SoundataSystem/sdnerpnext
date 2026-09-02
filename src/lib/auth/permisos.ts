/**
 * Módulo centralizado de permisos (RBAC).
 * Define recursos, acciones y el mapeo rol → permisos.
 * Único punto de verdad para autorización en toda la app.
 */

// ─── Recursos y acciones ──────────────────────────────────────────────────────
/** Recursos del sistema */
export const RECURSOS = [
  "ventas",
  "compras",
  "inventario",
  "contabilidad",
  "devoluciones_venta",
  "devoluciones_compra",
  "cotizaciones",
  "caja",
  "clientes",
  "productos",
  "proveedores",
  "usuarios",
  "configuracion",
  "servicios",
  "pegasus",
  "devoluciones",
  "ajustes",
  "transferencias",
  "reportes",
] as const;

export type Recurso = (typeof RECURSOS)[number];

/** Acciones estándar por recurso */
export const ACCIONES = [
  "leer",
  "crear",
  "editar",
  "eliminar",
  "aprobar",
  "anular",
  "cobrar",
  "facturar",
  "recibir",
  "pagar",
  "ajustar",
  "transferir",
  "aprobar_ajuste",
  "contabilizar",
  "asentar",
  "importar",
  "exportar",
  "configurar",
] as const;

export type Accion = (typeof ACCIONES)[number];

// ─── Permisos compuestos ─────────────────────────────────────────────────────
/** Permiso = "recurso:accion" (ej: "ventas:crear") */
export type Permiso = `${Recurso}:${Accion}`;

/** Genera un permiso compuesto */
export function permiso(recurso: Recurso, accion: Accion): Permiso {
  return `${recurso}:${accion}`;
}

/** Parsea un permiso compuesto */
export function parsearPermiso(permiso: Permiso): { recurso: Recurso; accion: Accion } {
  const [recurso, accion] = permiso.split(":") as [Recurso, Accion];
  return { recurso, accion };
}

// ─── Mapa de roles a permisos ────────────────────────────────────────────────
/**
 * Mapa centralizado: cada rol tiene un set de permisos.
 * Admin tiene todos los permisos (wildcard "*").
 */
export const ROLE_PERMISOS: Record<string, readonly string[]> = {
  admin: ["*"] as const,

  vendedor: [
    // Ventas
    "ventas:leer",
    "ventas:crear",
    "ventas:editar",
    "ventas:anular",
    "ventas:cobrar",
    "ventas:facturar",
    // Cotizaciones
    "cotizaciones:leer",
    "cotizaciones:crear",
    "cotizaciones:editar",
    "cotizaciones:aprobar",
    "cotizaciones:anular",
    // Clientes
    "clientes:leer",
    "clientes:crear",
    "clientes:editar",
    // Productos
    "productos:leer",
    // Caja (solo cobrar)
    "caja:leer",
    "caja:cobrar",
    // Devoluciones venta (equivalente exacto a legacy: admin,vendedor,cajero)
    "devoluciones_venta:leer",
    "devoluciones_venta:crear",
    "devoluciones_venta:aprobar",
    "devoluciones_venta:anular",
    // Servicios
    "servicios:leer",
    "servicios:crear",
    "servicios:editar",
  ] as const,

  cajero: [
    "ventas:leer",
    "ventas:cobrar",
    "ventas:facturar",
    "cotizaciones:leer",
    "clientes:leer",
    "productos:leer",
    "caja:leer",
    "caja:cobrar",
    "caja:facturar",
    "caja:anular",
    // Devoluciones venta (equivalente exacto a legacy: admin,vendedor,cajero)
    "devoluciones_venta:leer",
    "devoluciones_venta:crear",
    "devoluciones_venta:aprobar",
    "devoluciones_venta:anular",
  ] as const,

  contabilidad: [
    "ventas:leer",
    "cotizaciones:leer",
    "clientes:leer",
    "productos:leer",
    "proveedores:leer",
    "contabilidad:leer",
    "contabilidad:crear",
    "contabilidad:editar",
    "contabilidad:contabilizar",
    "contabilidad:asentar",
    "caja:leer",
    "caja:facturar",
    "reportes:leer",
    "reportes:exportar",
  ] as const,

  compra: [
    "compras:leer",
    "compras:crear",
    "compras:editar",
    "compras:aprobar",
    "compras:recibir",
    "compras:pagar",
    "compras:anular",
    "proveedores:leer",
    "proveedores:crear",
    "proveedores:editar",
    "proveedores:eliminar",
    "productos:leer",
    "productos:crear",
    "devoluciones_compra:leer",
    "devoluciones_compra:crear",
    "devoluciones_compra:aprobar",
    "devoluciones_compra:anular",
    "configuracion:leer",
  ] as const,

  administracion: [
    "ventas:leer",
    "ventas:editar",
    "ventas:anular",
    "cotizaciones:leer",
    "cotizaciones:aprobar",
    "cotizaciones:anular",
    "clientes:leer",
    "clientes:crear",
    "clientes:editar",
    "productos:leer",
    "productos:crear",
    "productos:editar",
    "productos:eliminar",
    "inventario:leer",
    "inventario:crear",
    "inventario:editar",
    "inventario:eliminar",
    "ajustes:leer",
    "ajustes:crear",
    "ajustes:aprobar",
    "ajustes:anular",
    "transferencias:leer",
    "transferencias:crear",
    "transferencias:aprobar",
    "devoluciones_venta:leer",
    "devoluciones_venta:aprobar",
    "devoluciones_compra:leer",
    "devoluciones_compra:aprobar",
    "configuracion:leer",
    "configuracion:editar",
    "configuracion:configurar",
    "usuarios:leer",
    "usuarios:crear",
    "usuarios:editar",
    "usuarios:eliminar",
    "reportes:leer",
    "reportes:exportar",
    "reportes:importar",
  ] as const,

  logistica: [
    "inventario:leer",
    "inventario:crear",
    "inventario:editar",
    "inventario:transferir",
    "inventario:ajustar",
    "productos:leer",
    "productos:crear",
    "ajustes:leer",
    "ajustes:crear",
    "ajustes:aprobar",
    "ajustes:anular",
    "transferencias:leer",
    "transferencias:crear",
    "transferencias:aprobar",
    "transferencias:anular",
    "compras:leer",
    "devoluciones_compra:leer",
    "devoluciones_compra:aprobar",
  ] as const,

  deposito: [
    "inventario:leer",
    "inventario:ajustar",
    "inventario:transferir",
    "ajustes:leer",
    "ajustes:crear",
    "ajustes:aprobar",
    "transferencias:leer",
    "transferencias:crear",
    "productos:leer",
    "productos:ajustar",
  ] as const,

  devoluciones: [
    "devoluciones_venta:leer",
    "devoluciones_venta:crear",
    "devoluciones_venta:aprobar",
    "devoluciones_compra:leer",
    "devoluciones_compra:crear",
    "devoluciones_compra:aprobar",
    "ventas:leer",
    "compras:leer",
    "productos:leer",
    "clientes:leer",
    "proveedores:leer",
  ] as const,

  ajustes: [
    "ajustes:leer",
    "ajustes:crear",
    "ajustes:aprobar",
    "productos:leer",
  ] as const,

  transferencias: [
    "transferencias:leer",
    "transferencias:crear",
    "transferencias:aprobar",
    "productos:leer",
  ] as const,

  recepcion_compras: [
    "compras:leer",
    "compras:recibir",
    "compras:aprobar",
    "proveedores:leer",
    "proveedores:crear",
    "productos:leer",
    "inventario:leer",
    "devoluciones_compra:leer",
    "devoluciones_compra:crear",
  ] as const,

  servicio_tecnico: [
    "servicios:leer",
    "servicios:crear",
    "servicios:editar",
    "servicios:aprobar",
    "productos:leer",
    "productos:crear",
    "clientes:leer",
    "clientes:editar",
    "inventario:leer",
    "cotizaciones:leer",
    "cotizaciones:crear",
  ] as const,

  supervisor_tecnico: [
    "servicios:leer",
    "servicios:crear",
    "servicios:editar",
    "servicios:aprobar",
    "servicios:anular",
    "productos:leer",
    "productos:crear",
    "productos:editar",
    "clientes:leer",
    "clientes:crear",
    "clientes:editar",
    "inventario:leer",
    "inventario:crear",
    "cotizaciones:leer",
    "cotizaciones:crear",
    "cotizaciones:aprobar",
    "reportes:leer",
  ] as const,

  chofer: [
    "inventario:leer",
    "inventario:transferir",
    "transferencias:leer",
    "transferencias:crear",
    "productos:leer",
    "compras:leer",
    "ventas:leer",
    "clientes:leer",
  ] as const,

  nominal: [
    "inventario:leer",
    "productos:leer",
    "clientes:leer",
    "reportes:leer",
  ] as const,

  };

// ─── Helpers de verificación ─────────────────────────────────────────────────
/** Obtiene los permisos de un rol */
export function obtenerPermisosRol(rol: string): readonly string[] {
  return ROLE_PERMISOS[rol] ?? [];
}

/** Verifica si un rol tiene un permiso específico */
export function rolTienePermiso(rol: string, permiso: string): boolean {
  const permisos = ROLE_PERMISOS[rol];
  if (!permisos) return false;
  if (permisos.includes("*")) return true;
  return permisos.includes(permiso);
}

/** Verifica si un rol tiene alguno de los permisos dados */
export function rolTieneAlgunPermiso(rol: string, permisos: readonly string[]): boolean {
  return permisos.some((p) => rolTienePermiso(rol, p));
}

/** Verifica si un rol tiene todos los permisos dados */
export function rolTieneTodosPermisos(rol: string, permisos: readonly string[]): boolean {
  return permisos.every((p) => rolTienePermiso(rol, p));
}

/** Obtiene todos los roles que tienen un permiso */
export function rolesConPermiso(permiso: string): string[] {
  return Object.entries(ROLE_PERMISOS)
    .filter(([, perms]) => perms.includes("*") || perms.includes(permiso))
    .map(([rol]) => rol);
}

/** Verifica si un rol existe en el catálogo */
export function rolExiste(rol: string): boolean {
  return rol in ROLE_PERMISOS;
}

/** Obtiene todos los roles definidos */
export function obtenerRoles(): string[] {
  return Object.keys(ROLE_PERMISOS);
}

// ─── Compatibilidad con API actual (rolesPermiten) ───────────────────────────
import { rolesPermiten as rolesPermitenLegacy } from "@/lib/usuarios/roles";

/**
 * Verifica si un rol tiene un permiso específico (recurso:acción).
 */
export function verificarPermiso(rolUsuario: string, recurso: Recurso, accion: Accion): boolean {
  const permiso = `${recurso}:${accion}`;
  return rolTienePermiso(rolUsuario, permiso);
}

/**
 * Verifica si un rol tiene alguno de los permisos (OR lógico).
 */
export function verificarAlgunPermiso(
  rolUsuario: string,
  recurso: Recurso,
  acciones: readonly Accion[],
): boolean {
  return acciones.some((accion) => verificarPermiso(rolUsuario, recurso, accion));
}

/**
 * Verifica si un rol tiene todos los permisos (AND lógico).
 */
export function verificarTodosPermisos(
  rolUsuario: string,
  recurso: Recurso,
  acciones: readonly Accion[],
): boolean {
  return acciones.every((accion) => verificarPermiso(rolUsuario, recurso, accion));
}

// Re-export para compatibilidad
export { rolesPermitenLegacy as rolesPermiten };
export type { Rol } from "@/lib/usuarios/roles";