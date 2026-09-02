/**
 * Solo se importa en Node.js runtime (no Edge).
 * Loguea errores no manejados con stack completo.
 */
export default function onUnhandledError() {
  process.on("unhandledRejection", (reason) => {
    console.error("[PRODQA unhandledRejection]", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("[PRODQA uncaughtException]", err);
  });
}
