export type ItemConPrecio = {
  cantidad: number;
} & ({ precio_unitario: number } | { unit_price: number });

// Subtotal genérico = Σ cantidad * precio, compatible con `precio_unitario` y `unit_price`.
export function calcularSubtotal(items: ItemConPrecio[]): number {
  return items.reduce(
    (s, it) =>
      s + it.cantidad * ("precio_unitario" in it ? it.precio_unitario : it.unit_price),
    0,
  );
}

// Formateador de guaraníes (singular para toda la app).
export function formatGs(n: number): string {
  return `₲ ${n.toLocaleString("es-PY")}`;
}

export function formatGsSigned(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₲ ${Math.abs(n).toLocaleString("es-PY")}`;
}

// Redondeo a guaraníes (sin centavos).
export function roundMoney(n: number): number {
  return Math.round(n);
}

// Saldo pendiente de cobro/pago. Nunca negativo.
export function saldoPendiente(
  monto_total: number,
  monto_pagado: number,
): number {
  return Math.max(0, monto_total - monto_pagado);
}