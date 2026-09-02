"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Undo2, Search, Plus, Eye, Check, X } from "lucide-react";
import {
  aprobarDevolucionVentaAction,
  rechazarDevolucionVentaAction,
} from "@/lib/actions/devoluciones-actions";
import { formatGs } from "@/lib/devoluciones/calculos";
import type { DevolucionVentaDTO } from "@/lib/devoluciones/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  aprobada: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "aprobada",
  },
  rechazada: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "rechazada",
  },
};

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendientes" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "rechazada", label: "Rechazadas" },
];

export function DevolucionesVentasListaClient({
  devoluciones,
}: {
  devoluciones: DevolucionVentaDTO[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const aprobar = useAction(aprobarDevolucionVentaAction, {
    onSuccess: () => toast.success("Devolución aprobada. Stock restituido"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const rechazar = useAction(rechazarDevolucionVentaAction, {
    onSuccess: () => toast.success("Devolución rechazada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const filtrados = useMemo(() => {
    let items = devoluciones;
    if (filtro !== "todos") items = items.filter((d) => d.estado === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      items = items.filter(
        (d) =>
          d.numero_devolucion?.toLowerCase().includes(q) ||
          d.cliente_nombre?.toLowerCase().includes(q) ||
          d.orden_numero?.toLowerCase().includes(q),
      );
    }
    return items;
  }, [devoluciones, busqueda, filtro]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Undo2 className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Devoluciones de Venta
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Devoluciones de clientes y estados
            </p>
          </div>
        </div>
        <Link
          href="/devoluciones/ventas/nuevo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nueva Devolución
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {devoluciones.length} devoluciones
          </p>
          <div className="flex-1" />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm"
            />
          </div>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {FILTROS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {filtrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">N°</th>
                  <th className="px-3 py-2 font-medium">Orden</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => {
                  const est =
                    ESTADO_BADGE[d.estado as string] ??
                    { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", label: d.estado };
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                        {d.numero_devolucion ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {d.orden_numero ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {d.cliente_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {formatGs(d.subtotal)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${est.cls}`}
                        >
                          {est.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {d.estado === "pendiente" && (
                            <>
                              <button
                                onClick={() => aprobar.execute({ id: d.id })}
                                disabled={aprobar.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Aprobar"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => rechazar.execute({ id: d.id })}
                                disabled={rechazar.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Rechazar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <Link
                            href={`/devoluciones/ventas/${d.id}`}
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Undo2 className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay devoluciones de venta registradas
            </p>
            <Link
              href="/devoluciones/ventas/nuevo"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nueva Devolución
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
