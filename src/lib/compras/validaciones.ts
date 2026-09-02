import type { EstadoOrdenCompra } from "@/lib/compras/schema";

// Doc P.3.1: las OC solo admiten recepciones en estado 'enviada' o 'recepcion_parcial'.
export const ESTADOS_OC_ACEPTAN_RECEPCION: readonly EstadoOrdenCompra[] = [
  "enviada",
  "recepcion_parcial",
] as const;

export function errorEstadoRecepcion(estado: string): string | null {
  if ((ESTADOS_OC_ACEPTAN_RECEPCION as readonly string[]).includes(estado)) {
    return null;
  }
  return `La OC en estado ${estado} no admite recepciones (solo enviada o recepcion_parcial)`;
}

export interface SobreRecepcionInput {
  yaRecibido: number;
  nuevo: number;
  solicitado: number;
  productoNombre?: string | null;
}

export function errorSobreRecepcion(input: SobreRecepcionInput): string | null {
  const { yaRecibido, nuevo, solicitado } = input;
  if (nuevo < 0) return "La cantidad recibida no puede ser negativa";
  const total = yaRecibido + nuevo;
  if (total > solicitado) {
    const sufijo = input.productoNombre ? ` en ${input.productoNombre}` : "";
    return `La cantidad recibida (${total}) supera la solicitada (${solicitado})${sufijo}`;
  }
  return null;
}

export interface ItemCompleto {
  id: string;
  cantidad: number;
  cantidad_recibida: number;
}

// Determina si TODOS los ítems de la OC quedaron completos tras una recepción.
// Se evalúa sobre todos los ítems (no solo los recibidos en esta operación)
// porque la UI envía únicamente los ítems con cantidad > 0.
export function todosLosItemsCompletos(
  ocItems: ItemCompleto[],
  totalesNuevos: ReadonlyMap<string, number>,
): boolean {
  return ocItems.every((item) => {
    const total = totalesNuevos.get(item.id) ?? item.cantidad_recibida;
    return total >= item.cantidad;
  });
}

export function errorPagoSuperaSaldo(input: {
  monto: number;
  saldo: number;
}): string | null {
  if (input.monto > input.saldo) {
    return `El monto (₲${input.monto.toLocaleString()}) supera el saldo pendiente (₲${input.saldo.toLocaleString()})`;
  }
  return null;
}
