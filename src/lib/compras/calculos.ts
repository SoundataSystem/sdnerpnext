// Utilidades de cálculo de compras — puras y testeables.

export { calcularSubtotal, formatGs, saldoPendiente } from "@/lib/money";

export interface ItemCompra {
  cantidad: number;
  unit_price: number;
}

// IVA 10% (Paraguay). Si la OC es "is_tax_included" no se agrega impuesto.
export const TASA_IVA = 0.1;

export function calcularImpuestos(
  subtotal: number,
  isTaxIncluded: boolean,
): number {
  return isTaxIncluded ? 0 : Math.round(subtotal * TASA_IVA);
}

// Costo operativo = subtotal * porcentaje / 100.
export function calcularCostoOperativo(
  subtotal: number,
  porcentaje: number,
): number {
  return Math.round(subtotal * (porcentaje / 100));
}

// Total = subtotal + impuestos + costo operativo.
export function calcularTotal(
  subtotal: number,
  impuestos: number,
  costoOperativo: number,
): number {
  return Math.max(0, subtotal + impuestos + costoOperativo);
}
