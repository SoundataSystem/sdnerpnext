export function contarSegmentos(codigo: string): number {
  return codigo.split(".").filter((s) => s.trim() !== "").length;
}

export function calcularNivelCuenta(
  codigo: string,
  padreNivel: number | null | undefined,
): number {
  if (padreNivel != null) return padreNivel + 1;
  return contarSegmentos(codigo);
}

export function validarCodigoJerarquico(
  codigo: string,
  padreCodigo: string | null | undefined,
): string | null {
  if (!padreCodigo) return null;
  const prefijo = `${padreCodigo}.`;
  if (!codigo.startsWith(prefijo)) {
    return `El código "${codigo}" debe empezar por el código del padre "${padreCodigo}."`;
  }
  return null;
}

export function cuentaEsDescendienteOIgual(
  cuentaId: string,
  posibleAncestroId: string,
  padreIdPorCuenta: ReadonlyMap<string, string | null>,
): boolean {
  let actual: string | null = cuentaId;
  while (actual) {
    if (actual === posibleAncestroId) return true;
    actual = padreIdPorCuenta.get(actual) ?? null;
  }
  return false;
}
