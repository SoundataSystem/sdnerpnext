export type AccionRma =
  | "recibir"
  | "iniciar_diagnostico"
  | "diagnosticar"
  | "resolver"
  | "cerrar"
  | "rechazar"
  | "cancelar";

export type EstadoRma =
  | "pendiente"
  | "recibido"
  | "en_diagnostico"
  | "diagnosticado"
  | "resuelto"
  | "cerrado"
  | "rechazado"
  | "cancelado";

const TRANSICIONES: Record<AccionRma, Record<string, EstadoRma>> = {
  recibir: { pendiente: "recibido" },
  iniciar_diagnostico: { recibido: "en_diagnostico" },
  diagnosticar: { en_diagnostico: "diagnosticado" },
  resolver: { diagnosticado: "resuelto" },
  cerrar: { resuelto: "cerrado" },
  rechazar: {
    pendiente: "rechazado",
    recibido: "rechazado",
    en_diagnostico: "rechazado",
    diagnosticado: "rechazado",
    resuelto: "rechazado",
  },
  cancelar: {
    pendiente: "cancelado",
    recibido: "cancelado",
    en_diagnostico: "cancelado",
    diagnosticado: "cancelado",
    resuelto: "cancelado",
  },
};

export function siguienteEstadoRma(
  estado: string,
  accion: AccionRma,
): EstadoRma {
  const destino = TRANSICIONES[accion]?.[estado];
  if (!destino) {
    throw new Error(`Transición inválida: "${accion}" desde estado "${estado}"`);
  }
  return destino;
}

export const ESTADOS_RMA_FINALES = ["cerrado", "cancelado", "rechazado"];

export function esEstadoRmaFinal(estado: string): boolean {
  return ESTADOS_RMA_FINALES.includes(estado);
}
