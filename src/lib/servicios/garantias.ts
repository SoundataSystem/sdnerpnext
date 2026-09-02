export function formatearCodigoGarantia(year: number, seq: number): string {
  return `G-${year}-${String(Math.max(1, seq)).padStart(4, "0")}`;
}

export function calcularVencimientoGarantia(desde: Date, meses: number): Date {
  const vencimiento = new Date(desde);
  vencimiento.setMonth(vencimiento.getMonth() + meses);
  return vencimiento;
}

export interface ItemOrdenConSerial {
  serial: string | null;
  serial_producto: string | null;
}

export function serialesARestituir(
  items: ItemOrdenConSerial[],
  cantidad: number,
): string[] {
  const resultado: string[] = [];
  let restante = cantidad;
  for (const it of items) {
    if (restante <= 0) break;
    const serial = it.serial ?? it.serial_producto;
    if (!serial?.trim()) continue;
    const s = serial.trim();
    if (resultado.includes(s)) continue;
    resultado.push(s);
    restante -= 1;
  }
  return resultado;
}
