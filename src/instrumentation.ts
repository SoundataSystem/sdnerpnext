/**
 * Next.js Instrumentation Hook
 * Captura errores de Server Components con stack completo.
 * Ver: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  // No-op: el logging se hace en onRequestError
}

export function onRequestError(
  err: { digest?: string; message?: string; stack?: string } & Error,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string },
) {
  // Loguea el error completo del servidor — visible en Vercel Function Logs
  console.error(
    "[PRODQA RSC Error]",
    JSON.stringify({
      digest: err.digest,
      message: err.message,
      path: request.path,
      routePath: context.routePath,
      stack: err.stack?.split("\n").slice(0, 8).join(" | "),
    }),
  );
}
