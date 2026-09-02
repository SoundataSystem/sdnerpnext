"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En producción el mensaje está omitido; solo el digest es útil para logs de Vercel
    console.error("[Error Boundary] digest:", error.digest, "| message:", error.message);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-8 dark:bg-black">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>

      <div className="text-center">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Algo salió mal
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Ocurrió un error al cargar esta página. Podés intentar de nuevo o
          volver al inicio.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-zinc-400 dark:text-zinc-600">
            ref: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <RefreshCw className="h-4 w-4" />
          Intentar de nuevo
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
