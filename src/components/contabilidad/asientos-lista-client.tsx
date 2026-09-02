"use client";

import { fechaCorta, numero } from "@/lib/formato";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { ScrollText, Search, Plus, CheckCircle, XCircle, Eye } from "lucide-react";
import {
  contabilizarAsientoAction,
  anularAsientoAction,
} from "@/lib/actions/contabilidad-actions";
import type { AsientoDTO } from "@/lib/contabilidad/repository";

const ESTADO_BADGE: Record<
  string,
  { cls: string; label: string }
> = {
  borrador: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "borrador",
  },
  contabilizado: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "contabilizado",
  },
  cancelado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "cancelado",
  },
};

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "borrador", label: "Borradores" },
  { value: "contabilizado", label: "Contabilizados" },
  { value: "cancelado", label: "Cancelados" },
];

export function AsientosListaClient({
  asientos,
}: {
  asientos: AsientoDTO[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [modalAnular, setModalAnular] = useState<string | null>(null);

  const contabilizar = useAction(contabilizarAsientoAction, {
    onSuccess: () => toast.success("Asiento contabilizado"),
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al contabilizar"),
  });

  const anular = useAction(anularAsientoAction, {
    onSuccess: () => {
      toast.success("Asiento anulado");
      setModalAnular(null);
      setMotivo("");
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al anular asiento"),
  });

  const filtrados = useMemo(() => {
    let items = asientos;
    if (filtro !== "todos") items = items.filter((a) => a.estado === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      items = items.filter(
        (a) =>
          a.numero_asiento.toLowerCase().includes(q) ||
          a.concepto.toLowerCase().includes(q),
      );
    }
    return items;
  }, [asientos, busqueda, filtro]);

  const totalDebe = (a: AsientoDTO) =>
    a.detalles.reduce((s, d) => s + (d.debe || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Asientos Contables
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Registro de asientos de diario
            </p>
          </div>
        </div>
        <Link
          href="/contabilidad/asientos/nuevo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nuevo Asiento
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {asientos.length} asientos
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
                  <th className="px-3 py-2 font-medium">N° Asiento</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 font-medium">Líneas</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => {
                  const badge = ESTADO_BADGE[a.estado] ?? {
                    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                    label: a.estado,
                  };
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                        {a.numero_asiento}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {fechaCorta(a.fecha)}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {a.concepto}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {a.detalles.length} líneas
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        ₲ {numero(totalDebe(a))}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {a.estado === "borrador" && (
                            <>
                              <button
                                onClick={() => contabilizar.execute({ id: a.id })}
                                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Contabilizar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setAnulandoId(a.id);
                                  setModalAnular(a.id);
                                }}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Anular"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <Link
                            href={`/contabilidad/asientos/${a.id}`}
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
            <ScrollText className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">No hay asientos contables</p>
            <Link
              href="/contabilidad/asientos/nuevo"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nuevo Asiento
            </Link>
          </div>
        )}
      </div>

      {modalAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Anular asiento
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Indica el motivo de anulación (obligatorio)
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Motivo..."
              className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setModalAnular(null);
                  setMotivo("");
                  setAnulandoId(null);
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!anulandoId) return;
                  if (!motivo.trim()) {
                    toast.warning("El motivo es obligatorio");
                    return;
                  }
                  anular.execute({ id: anulandoId, motivo: motivo.trim() });
                }}
                disabled={anular.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {anular.isPending ? "Anulando..." : "Anular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}