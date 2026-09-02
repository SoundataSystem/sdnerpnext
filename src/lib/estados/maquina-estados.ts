/**
 * Módulo centralizado de máquinas de estado (State Machines).
 * Define transiciones válidas, precondiciones y efectos secundarios por entidad.
 * Único punto de verdad para validación de transiciones de estado.
 */

// ─── Tipos de estado ─────────────────────────────────────────────────────────
// Definimos localmente para evitar dependencia de @prisma/client en tiempo de compilación
export type EstadoOrdenVenta = "pendiente" | "completada" | "cancelada";
export type EstadoCaja = "pendiente" | "cobrado" | "parcial" | "facturado" | "anulado";
export type EstadoOC = "borrador" | "pendiente" | "pendiente_aprobacion" | "aprobada" | "enviada" | "recepcion_parcial" | "recepcion_completa" | "pendiente_ingreso_stock" | "ingresada" | "cerrada" | "cancelada";
export type EstadoDevolucion = "pendiente" | "aprobada" | "rechazada";

/**
 * Transiciones válidas para Órdenes de Venta
 * Formato: { desde: { a: [estados], precondicion?: fn } }
 */
export const TRANSICIONES_ORDEN_VENTA: Record<
  EstadoOrdenVenta,
  { a: EstadoOrdenVenta[]; precondicion?: (ctx: { cajaMovimientos?: { estado: string }[] }) => boolean }
> = {
  pendiente: {
    a: ["completada", "cancelada"],
    precondicion: (ctx) => {
      // Para cancelar: no debe tener cobros/facturas
      // Para completar: siempre permitido desde pendiente
      return true;
    },
  },
  completada: {
    a: [], // estado terminal (no se puede cancelar ni volver a pendiente)
    precondicion: () => true,
  },
  cancelada: {
    a: [], // estado terminal
    precondicion: () => true,
  },
};

/**
 * Valida si una transición de orden de venta es válida
 */
export function validarTransicionOrdenVenta(
  estadoActual: EstadoOrdenVenta,
  estadoNuevo: EstadoOrdenVenta,
  contexto?: { cajaMovimientos?: { estado: string }[] },
): { valido: boolean; error?: string } {
  const transicion = TRANSICIONES_ORDEN_VENTA[estadoActual];
  if (!transicion) return { valido: false, error: `Estado actual inválido: ${estadoActual}` };
  if (!transicion.a.includes(estadoNuevo)) {
    return { valido: false, error: `Transición inválida: ${estadoActual} → ${estadoNuevo}` };
  }
  if (transicion.precondicion && !transicion.precondicion({ cajaMovimientos: contexto?.cajaMovimientos })) {
    return { valido: false, error: "Precondición no cumplida para la transición" };
  }
  return { valido: true };
}

// ─── Caja (Movimientos de Caja) ──────────────────────────────────────────────

export const TRANSICIONES_CAJA: Record<
  EstadoCaja,
  { a: EstadoCaja[]; precondicion?: (ctx: { montoPagado?: number; montoTotal?: number }) => boolean }
> = {
  pendiente: {
    a: ["cobrado", "parcial", "anulado"],
    precondicion: (ctx) => {
      if (!ctx.montoPagado || ctx.montoPagado <= 0) return false;
      return true;
    },
  },
  parcial: {
    a: ["cobrado", "anulado"],
    precondicion: (ctx) => {
      if (!ctx.montoPagado || ctx.montoPagado <= 0) return false;
      return true;
    },
  },
  cobrado: {
    a: ["facturado", "anulado"],
    precondicion: () => true,
  },
  facturado: {
    a: ["anulado"], // solo se puede anular una factura
    precondicion: () => true,
  },
  anulado: {
    a: [], // terminal
    precondicion: () => true,
  },
};

export function validarTransicionCaja(
  estadoActual: EstadoCaja,
  estadoNuevo: EstadoCaja,
  contexto?: { montoPagado?: number; montoTotal?: number },
): { valido: boolean; error?: string } {
  const transicion = TRANSICIONES_CAJA[estadoActual];
  if (!transicion) return { valido: false, error: `Estado actual inválido: ${estadoActual}` };
  if (!transicion.a.includes(estadoNuevo)) {
    return { valido: false, error: `Transición inválida: ${estadoActual} → ${estadoNuevo}` };
  }
  if (transicion.precondicion && !transicion.precondicion({ montoPagado: contexto?.montoPagado, montoTotal: contexto?.montoTotal })) {
    return { valido: false, error: "Precondición no cumplida (monto inválido)" };
  }
  return { valido: true };
}

// ─── Compras (Órdenes de Compra) ─────────────────────────────────────────────

export const TRANSICIONES_OC: Record<
  EstadoOC,
  { a: EstadoOC[]; precondicion?: (ctx: { total?: number }) => boolean }
> = {
  borrador: { a: ["aprobada", "cancelada"], precondicion: () => true },
  pendiente: { a: ["aprobada", "cancelada"], precondicion: () => true },
  pendiente_aprobacion: { a: ["aprobada", "cancelada"], precondicion: () => true },
  aprobada: { a: ["enviada", "cancelada"], precondicion: () => true },
  enviada: { a: ["recepcion_parcial", "recepcion_completa", "cancelada"], precondicion: () => true },
  recepcion_parcial: { a: ["recepcion_parcial", "recepcion_completa", "pendiente_ingreso_stock", "cancelada"], precondicion: () => true },
  recepcion_completa: { a: ["pendiente_ingreso_stock", "cancelada"], precondicion: () => true },
  pendiente_ingreso_stock: { a: ["ingresada", "cancelada"], precondicion: () => true },
  ingresada: { a: ["cerrada"], precondicion: () => true },
  cerrada: { a: [], precondicion: () => true }, // terminal
  cancelada: { a: [], precondicion: () => true }, // terminal
};

export function validarTransicionOC(
  estadoActual: EstadoOC,
  accion: "aprobar" | "enviar" | "cancelar" | "cerrar",
): { valido: boolean; error?: string; estadoNuevo?: EstadoOC } {
  const transicion = TRANSICIONES_OC[estadoActual];
  if (!transicion) return { valido: false, error: `Estado actual inválido: ${estadoActual}` };

  const mapaAccion: Record<string, EstadoOC> = {
    aprobar: "aprobada",
    enviar: "enviada",
    cancelar: "cancelada",
    cerrar: "cerrada",
  };

  const estadoNuevo = mapaAccion[accion];
  if (!estadoNuevo || !transicion.a.includes(estadoNuevo)) {
    return { valido: false, error: `Acción '${accion}' inválida desde estado ${estadoActual}` };
  }
  if (transicion.precondicion && !transicion.precondicion({})) {
    return { valido: false, error: "Precondición no cumplida" };
  }
  return { valido: true, estadoNuevo };
}

// ─── Devoluciones (Venta y Compra) ───────────────────────────────────────────

export const TRANSICIONES_DEVOLUCION: Record<
  EstadoDevolucion,
  { a: EstadoDevolucion[]; precondicion?: () => boolean }
> = {
  pendiente: { a: ["aprobada", "rechazada"], precondicion: () => true },
  aprobada: { a: [], precondicion: () => true }, // terminal
  rechazada: { a: [], precondicion: () => true }, // terminal
};

export function validarTransicionDevolucion(
  estadoActual: EstadoDevolucion,
  estadoNuevo: EstadoDevolucion,
): { valido: boolean; error?: string } {
  const transicion = TRANSICIONES_DEVOLUCION[estadoActual];
  if (!transicion) return { valido: false, error: `Estado actual inválido: ${estadoActual}` };
  if (!transicion.a.includes(estadoNuevo)) {
    return { valido: false, error: `Transición inválida: ${estadoActual} → ${estadoNuevo}` };
  }
  return { valido: true };
}

// ─── Caja (Movimientos de Caja - alias) ──────────────────────────────────────
export type EstadoCajaMovimiento = EstadoCaja; // alias

// ─── Helpers genéricos ───────────────────────────────────────────────────────

/**
 * Verifica si un estado es terminal (no tiene transiciones salientes)
 */
export function esEstadoTerminal<T extends string>(
  estado: T,
  transiciones: Record<string, { a: T[] }>,
): boolean {
  return !transiciones[estado] || transiciones[estado].a.length === 0;
}

/**
 * Obtiene todos los estados alcanzables desde un estado inicial (DFS)
 */
export function obtenerEstadosAlcanzables<T extends string>(
  estadoInicial: T,
  transiciones: Record<string, { a: T[] }>,
): T[] {
  const visitados = new Set<T>();
  const pila = [estadoInicial];

  while (pila.length > 0) {
    const actual = pila.pop()!;
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    const transicion = transiciones[actual];
    if (transicion) {
      for (const siguiente of transicion.a) {
        if (!visitados.has(siguiente)) pila.push(siguiente);
      }
    }
  }

  return Array.from(visitados);
}

/**
 * Valida que una secuencia de transiciones sea válida completa
 */
export function validarSecuenciaEstados<T extends string>(
  estados: T[],
  transiciones: Record<string, { a: T[] }>,
): { valido: boolean; error?: string; indiceError?: number } {
  for (let i = 0; i < estados.length - 1; i++) {
    const actual = estados[i];
    const siguiente = estados[i + 1];
    const transicion = transiciones[actual];
    if (!transicion || !transicion.a.includes(siguiente)) {
      return { valido: false, error: `Transición inválida: ${actual} → ${siguiente}`, indiceError: i };
    }
  }
  return { valido: true };
}

// ─── Export centralizado de todas las transiciones ───────────────────────────
export const STATE_MACHINES = {
  ordenVenta: TRANSICIONES_ORDEN_VENTA,
  caja: TRANSICIONES_CAJA,
  oc: TRANSICIONES_OC,
  devolucion: TRANSICIONES_DEVOLUCION,
} as const;

export type EstadoTipo = EstadoOrdenVenta | EstadoCaja | EstadoOC | EstadoDevolucion;