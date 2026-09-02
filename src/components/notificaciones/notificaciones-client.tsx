"use client";

import { fechaHora } from "@/lib/formato";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import {
  marcarNotificacionLeidaAction,
  marcarTodasNotificacionesLeidasAction,
} from "@/lib/actions/notificaciones-actions";
import type { NotificacionDTO } from "@/lib/notificaciones/repository";

function iconoTipo(tipo: string) {
  if (tipo.includes("oc") || tipo.includes("compra"))
    return <ShoppingCart className="h-4 w-4" />;
  if (tipo.includes("rma") || tipo.includes("ticket") || tipo.includes("garantia"))
    return <Wrench className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function NotificacionesClient({
  items,
  no_leidas,
  total,
  page,
  totalPages,
}: {
  items: NotificacionDTO[];
  no_leidas: number;
  total: number;
  page: number;
  totalPages: number;
}) {
  const marcar = useAction(marcarNotificacionLeidaAction, {
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const marcarTodas = useAction(marcarTodasNotificacionesLeidasAction, {
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Notificaciones
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Avisos de aprobaciones, devoluciones, RMAs y más
              {no_leidas > 0 && ` · ${no_leidas} sin leer`}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No tenés notificaciones
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.leida && marcar.execute({ id: n.id })}
                className={`flex w-full items-start gap-3 px-2 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                  n.leida ? "opacity-60" : ""
                }`}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {iconoTipo(n.tipo_evento)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {n.titulo}
                  </p>
                  {n.mensaje && (
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {n.mensaje}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {fechaHora(n.created_at)}
                  </p>
                </div>
                {!n.leida && (
                  <span className="mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            Página {page} de {totalPages} · {total} en total
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/notificaciones?page=${page - 1}`}
              aria-disabled={page <= 1}
              className={`inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 ${
                page <= 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
            <Link
              href={`/notificaciones?page=${page + 1}`}
              aria-disabled={page >= totalPages}
              className={`inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 ${
                page >= totalPages ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {items.some((n) => !n.leida) && (
        <button
          onClick={() => marcarTodas.execute()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <CheckCheck className="h-4 w-4" /> Marcar todas como leídas
        </button>
      )}
    </div>
  );
}
