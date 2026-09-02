// ────────────────────────────────────────────────────────────────────────────
// Utilidades de cálculo de ventas — puras y testeables
// (sin dependencias de React ni de la base de datos)
// ────────────────────────────────────────────────────────────────────────────

import {
  calcularSubtotal,
  formatGs,
  formatGsSigned,
  roundMoney,
  saldoPendiente,
} from "@/lib/money";

export {
  calcularSubtotal,
  formatGs,
  formatGsSigned,
  roundMoney,
  saldoPendiente,
};

export interface ItemCalculo {
  cantidad: number;
  precio_unitario: number;
}

export interface Cargos {
  shipping_fee?: number;
  insurance_fee?: number;
  customs_duty?: number;
  other_fees?: number;
  descuento?: number;
}

// Total = subtotal + cargos - descuento. Nunca negativo.
export function calcularTotal(
  subtotal: number,
  cargos: Cargos = {},
): number {
  const extra =
    (cargos.shipping_fee ?? 0) +
    (cargos.insurance_fee ?? 0) +
    (cargos.customs_duty ?? 0) +
    (cargos.other_fees ?? 0);
  return Math.max(0, subtotal + extra - (cargos.descuento ?? 0));
}

export type TipoVenta = "contado" | "credito" | "web" | "mayor" | "tax_free" | "iva_incluido" | "delivery";

export interface CalculoVenta {
  tipo_venta: TipoVenta;
  costo_operativo_porcentaje: number;
  comision_porcentaje: number;
  iva_tasa?: number;
  /** Costo de delivery en la moneda de la venta (solo GS; no aplica a USD). */
  costo_delivery?: number;
}

export interface ResultadoCalculoVenta {
  subtotal: number;
  iva: number;
  base: number;
  costo_operativo: number;
  comision_vendedor: number;
  costo_delivery: number;
  total: number;
}

const IVA_TASA = 0.1;

/**
 * Cálculo de una venta según el tipo (Contado/Delivery suman IVA 10%;
 * Tax Free e IVA Incluido no suman IVA extra). El costo operativo y la
 * comisión del vendedor se calculan como % sobre la base (subtotal + IVA).
 * "Total Cobrado" incluye el costo operativo.
 *
 * Delivery: el costo de delivery se suma DESPUÉS del IVA (misma lógica que
 * el ERP React): total = subtotal + IVA + costo_delivery. Solo se aplica
 * cuando tipo_venta === "delivery".
 */
export function calcularVenta(
  subtotal: number,
  opts: CalculoVenta,
): ResultadoCalculoVenta {
  // PROD QA: Tax Free y Por Mayor exentos de IVA
  const esExento = opts.tipo_venta === "tax_free" || opts.tipo_venta === "mayor";
  const esIvaIncluido = opts.tipo_venta === "iva_incluido";
  let iva = 0;
  if (esIvaIncluido) {
    // IVA incluido: iva = subtotal - round(subtotal/1.1)  (PROD QA VentasCrear.tsx:178)
    iva = subtotal - Math.round(subtotal / (1 + (opts.iva_tasa ?? IVA_TASA)));
  } else if (!esExento) {
    iva = roundMoney(subtotal * (opts.iva_tasa ?? IVA_TASA));
  }
  const costo_delivery =
    opts.tipo_venta === "delivery" ? Math.max(0, opts.costo_delivery ?? 0) : 0;
  // total = subtotal + (ivaIncluido?0:iva) + delivery  (PROD QA: totalCalculado)
  const total = subtotal + (esIvaIncluido ? 0 : iva) + costo_delivery;
  const costo_operativo = roundMoney(
    total * (opts.costo_operativo_porcentaje / (100 + opts.costo_operativo_porcentaje)),
  );
  const comision_vendedor = roundMoney(
    total * (opts.comision_porcentaje / 100),
  );
  const base = total - costo_operativo;
  return {
    subtotal,
    iva,
    base,
    costo_operativo,
    comision_vendedor,
    costo_delivery,
    total,
  };
}

// ─── Delivery en observaciones (LEGACY) ─────────────────────────────────────
// El ERP React persistía el costo como `DELIVERY:<monto>` en `observaciones`.
// Desde 2026-09-02 shipping_fee es la fuente única; estos helpers quedan solo
// para lectura de VTA históricas y para el script de limpieza (scripts/limpiar-delivery-tags.mts).
// No escribir nuevos tags: usar shipping_fee.

const DELIVERY_RE = /DELIVERY:\s*([\d.,]+)/i;

export function parseDeliveryDeObservaciones(
  obs: string | null | undefined,
): number {
  if (!obs) return 0;
  const match = obs.match(DELIVERY_RE);
  if (!match) return 0;
  return roundMoney(Number(match[1].replace(/\./g, "").replace(",", ".")) || 0);
}

function componentesObservaciones(obs: string | null | undefined): string[] {
  return (obs ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Quita el tag GUARDADO `DELIVERY:<monto>` de observaciones (deja el texto del usuario). */
export function sinDeliveryEnObservaciones(
  obs: string | null | undefined,
): string {
  return componentesObservaciones(obs)
    .filter((part) => !DELIVERY_RE.test(part))
    .join(" | ");
}

/** Reincorpora el tag `DELIVERY:<monto>` al inicio de las observaciones. */
export function conDeliveryEnObservaciones(
  obs: string | null | undefined,
  costo_delivery: number,
): string {
  const base = sinDeliveryEnObservaciones(obs);
  const tag = costo_delivery > 0 ? `DELIVERY:${costo_delivery}` : "";
  return [tag, base].filter(Boolean).join(" | ");
}

export function formatUsd(n: number): string {
  return `$ ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// Helper para scripts: lectura legacy shipping_fee con fallback a tag
export function deliveryLegacyFallback(
  shippingFee: number | null | undefined,
  observaciones: string | null | undefined,
): number {
  const fee = Number(shippingFee ?? 0);
  return fee > 0 ? fee : parseDeliveryDeObservaciones(observaciones);
}

// Estado de cobro de una orden según lo pagado.
export function estadoCobroOrden(
  monto_total: number,
  monto_pagado: number,
): "cobrado" | "parcial" {
  return monto_pagado >= monto_total ? "cobrado" : "parcial";
}