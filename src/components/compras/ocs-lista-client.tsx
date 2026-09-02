"use client";

import { fechaCorta } from "@/lib/formato";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ShoppingCart,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import {
  aprobarOcAction,
  cancelarOcAction,
} from "@/lib/actions/compras-actions";
import { formatGs } from "@/lib/compras/calculos";
import type { OcDTO } from "@/lib/compras/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  borrador: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "borrador",
  },
  pendiente_aprobacion: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pend. aprobación",
  },
  aprobada: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "aprobada",
  },
  enviada: {
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "enviada",
  },
  recepcion_parcial: {
    cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    label: "recepción parcial",
  },
  recepcion_completa: {
    cls: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    label: "recepción completa",
  },
  pendiente_ingreso_stock: {
    cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    label: "pend. ingreso",
  },
  ingresada: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "ingresada",
  },
  cerrada: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "cerrada",
  },
  cancelada: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "cancelada",
  },
};

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "borrador", label: "Borradores" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "enviada", label: "Enviadas" },
  { value: "ingresada", label: "Ingresadas" },
  { value: "cancelada", label: "Canceladas" },
];

export function OcsListaClient({ ocs }: { ocs: OcDTO[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const aprobar = useAction(aprobarOcAction, {
    onSuccess: () => toast.success("OC aprobada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const cancelar = useAction(cancelarOcAction, {
    onSuccess: () => toast.success("OC cancelada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const filtrados = useMemo(() => {
    let items = ocs;
    if (filtro !== "todos") items = items.filter((o) => o.estado === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      items = items.filter(
        (o) =>
          o.numero_orden.toLowerCase().includes(q) ||
          o.proveedor_nombre?.toLowerCase().includes(q),
      );
    }
    return items;
  }, [ocs, busqueda, filtro]);

  const badge = (v: string | null) =>
    ESTADO_BADGE[v ?? ""] ?? {
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
      label: v ?? "—",
    };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Órdenes de Compra
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Listado de OC y estados
            </p>
          </div>
        </div>
        <Link
          href="/compras/ordenes/nuevo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nueva OC
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">{ocs.length} OC</p>
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
                  <th className="px-3 py-2 font-medium">N° OC</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">Emisión</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((o) => {
                  const est = badge(o.estado);
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                        {o.numero_orden}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {fechaCorta(o.created_at)}
                      </td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {o.proveedor_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {o.fecha_emision ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {formatGs(o.total)}
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
                          {o.estado === "borrador" && (
                            <>
                              <button
                                onClick={() => aprobar.execute({ id: o.id })}
                                disabled={aprobar.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Aprobar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => cancelar.execute({ id: o.id })}
                                disabled={cancelar.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Cancelar"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {(o.estado === "aprobada" ||
                            o.estado === "enviada") && (
                            <button
                              onClick={() => cancelar.execute({ id: o.id })}
                              disabled={cancelar.isPending}
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                              title="Cancelar"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          <Link
                            href={`/compras/ordenes/${o.id}`}
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
            <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay órdenes de compra registradas
            </p>
            <Link
              href="/compras/ordenes/nuevo"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nueva OC
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
