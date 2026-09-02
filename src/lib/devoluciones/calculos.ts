// Utilidades de cálculo de devoluciones — puras y testeables.

export { calcularSubtotal, formatGs } from "@/lib/money";

export interface ItemDevolucion {
  cantidad: number;
  precio_unitario: number;
}
