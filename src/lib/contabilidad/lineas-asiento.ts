export type CuentaAsiento = "caja" | "ventas" | "cxc";

export interface LineaAsiento {
  cuenta: CuentaAsiento;
  debe: number;
  haber: number;
}

export interface LineasCobroInput {
  pagadoAnterior: number;
  cobrado: boolean;
  montoPagado: number;
  montoTotal: number;
  saldo: number;
  tieneCxc: boolean;
}

// Construye las líneas del asiento de cobro manteniendo SUM(debe) = SUM(haber)
// en cualquier combinación de pagos parciales:
//  - Primera cuota (contado): reconoce el ingreso por ventas completo.
//  - Primera cuota parcial: caja + CxC vs ventas total (ingreso reconocido).
//  - Cuotas posteriores: saldan la CxC (el ingreso ya se reconoció antes).
export function lineasAsientoCobro(input: LineasCobroInput): LineaAsiento[] {
  const { pagadoAnterior, cobrado, montoPagado, montoTotal, saldo, tieneCxc } =
    input;

  if (pagadoAnterior > 0) {
    return tieneCxc
      ? [
          { cuenta: "caja", debe: montoPagado, haber: 0 },
          { cuenta: "cxc", debe: 0, haber: montoPagado },
        ]
      : [
          { cuenta: "caja", debe: montoPagado, haber: 0 },
          { cuenta: "ventas", debe: 0, haber: montoPagado },
        ];
  }

  if (cobrado) {
    return [
      { cuenta: "caja", debe: montoPagado, haber: 0 },
      { cuenta: "ventas", debe: 0, haber: montoPagado },
    ];
  }

  if (tieneCxc) {
    return [
      { cuenta: "caja", debe: montoPagado, haber: 0 },
      { cuenta: "ventas", debe: 0, haber: montoTotal },
      { cuenta: "cxc", debe: saldo, haber: 0 },
    ];
  }

  return [
    { cuenta: "caja", debe: montoPagado, haber: 0 },
    { cuenta: "ventas", debe: 0, haber: montoPagado },
  ];
}

export function asientoBalanceado(lineas: LineaAsiento[]): boolean {
  const debe = lineas.reduce((s, l) => s + l.debe, 0);
  const haber = lineas.reduce((s, l) => s + l.haber, 0);
  return debe === haber;
}
