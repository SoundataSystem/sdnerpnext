// Utilidades de cálculo de cotizaciones — puras y testeables.

export { calcularSubtotal, formatGs } from "@/lib/money";

export interface ItemCotizacion {
  cantidad: number;
  precio_unitario: number;
}

// Total = subtotal - descuento. Nunca negativo.
export function calcularTotal(subtotal: number, descuento: number): number {
  return Math.max(0, subtotal - Math.max(0, descuento));
}
