// Utilidades de cálculo del módulo de servicios — puras y testeables.

export { formatGs } from "@/lib/money";

// Costo total de una orden de servicio = mano de obra + repuestos.
export function calcularCostoTotal(
  costo_servicio: number,
  costo_repuestos: number,
): number {
  return Math.max(0, costo_servicio) + Math.max(0, costo_repuestos);
}

// Estado de garantía según vigencia: activa si hoy <= vencimiento.
export function garantiaVigente(
  fecha_vencimiento: string,
  hoy = new Date().toISOString().split("T")[0],
): boolean {
  return fecha_vencimiento >= hoy;
}
