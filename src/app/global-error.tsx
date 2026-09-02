"use client";

import { useEffect } from "react";

// global-error reemplaza al RootLayout entero, por eso necesita <html>/<body>
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Error crítico
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No se pudo cargar la aplicación.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-zinc-400">
              ref: {error.digest}
            </p>
          )}
        </div>
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
