/**
 * Valida que la URL de redirección sea segura (solo rutas internas).
 * Rechaza URLs con protocolo, protocol-relative, host externo o esquemas peligrosos.
 */
export function isSafeRedirectPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false; // protocol-relative
  // Rechazar esquemas peligrosos
  const dangerousSchemes = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "mailto:",
    "tel:",
    "ftp:",
  ];
  const lower = path.toLowerCase();
  for (const scheme of dangerousSchemes) {
    if (lower.includes(scheme)) return false;
  }
  // No permitir patrones que parezcan host externo (ej: /@evil.com, /\\evil.com)
  if (path.includes("@") || path.includes("\\")) return false;
  // Solo rutas internas válidas
  return true;
}