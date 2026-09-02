// Utilidades de cálculo de inventario — puras y testeables.

// Diferencia entre el stock nuevo y el actual.
export function diferenciaStock(stockNuevo: number, stockActual: number): number {
  return stockNuevo - stockActual;
}

// Dirección del movimiento según la diferencia.
export function direccionMovimiento(diferencia: number): "entrada" | "salida" {
  return diferencia >= 0 ? "entrada" : "salida";
}

// Estado de bajo stock: total < mínimo.
export function esBajoStock(stockTotal: number, stockMinimo: number): boolean {
  return stockMinimo > 0 && stockTotal < stockMinimo;
}

// Formateo de cantidades de inventario (enteras).
export function formatCantidad(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString("es-PY")
    : n.toLocaleString("es-PY", { maximumFractionDigits: 3 });
}

// Genera el N° de ajuste (AJ-YYYY-XXXX) desde un consecutivo.
export function numeroAjusteSecuencia(year: number, seq: number): string {
  return `AJ-${year}-${String(seq).padStart(4, "0")}`;
}