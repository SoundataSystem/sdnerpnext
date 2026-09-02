"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { LifeBuoy, Plus, Save, Play, CheckCircle, XCircle, Lock } from "lucide-react";
import {
  crearTicketAction,
  cambiarEstadoTicketAction,
} from "@/lib/actions/servicios-actions";
import type { TicketSoporteDTO } from "@/lib/servicios/repository";
import type { Prioridad } from "@/lib/servicios/schema";
import type { ClienteDTO } from "@/lib/ventas/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  en_curso: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "en curso",
  },
  resuelto: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "resuelto",
  },
  cerrado: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "cerrado",
  },
  cancelado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "cancelado",
  },
};

export function TicketsClient({
  tickets,
  clientes,
}: {
  tickets: TicketSoporteDTO[];
  clientes: ClienteDTO[];
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cliente_id, setClienteId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("normal");

  const crear = useAction(crearTicketAction, {
    onSuccess: () => {
      toast.success("Ticket creado");
      setMostrarForm(false);
      setAsunto("");
      setDescripcion("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const cambiarEstado = useAction(cambiarEstadoTicketAction, {
    onSuccess: () => toast.success("Estado del ticket actualizado"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const puedeGuardar = Boolean(
    cliente_id &&
      asunto.trim().length >= 3 &&
      descripcion.trim().length >= 3 &&
      !crear.isPending,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Soporte
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {tickets.length} tickets registrados
            </p>
          </div>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {mostrarForm ? (
            "Ocultar formulario"
          ) : (
            <>
              <Plus className="h-4 w-4" /> Nuevo Ticket
            </>
          )}
        </button>
      </div>

      {mostrarForm && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Cliente *
              </label>
              <select
                value={cliente_id}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Asunto *
              </label>
              <input
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Resumen del problema"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Prioridad
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                {["baja", "normal", "alta", "urgente"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Descripción *
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Detalla el problema reportado"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() =>
                crear.execute({
                  cliente_id,
                  asunto: asunto.trim(),
                  descripcion: descripcion.trim(),
                  prioridad: prioridad as Prioridad,
                })
              }
              disabled={!puedeGuardar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Save className="h-4 w-4" />{" "}
              {crear.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {tickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">N°</th>
                  <th className="px-3 py-2 font-medium">Asunto</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Prioridad</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const est =
                    ESTADO_BADGE[t.estado as string] ??
                    { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", label: t.estado };
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                        {t.numero_ticket ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {t.asunto ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {t.cliente_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 capitalize text-zinc-600 dark:text-zinc-400">
                        {t.prioridad}
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
                          {t.estado === "pendiente" && (
                            <button
                              onClick={() =>
                                cambiarEstado.execute({ id: t.id, estado: "en_curso" })
                              }
                              disabled={cambiarEstado.isPending}
                              className="rounded p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Iniciar"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {(t.estado === "pendiente" || t.estado === "en_curso") && (
                            <>
                              <button
                                onClick={() =>
                                  cambiarEstado.execute({ id: t.id, estado: "resuelto" })
                                }
                                disabled={cambiarEstado.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Resolver"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  cambiarEstado.execute({ id: t.id, estado: "cancelado" })
                                }
                                disabled={cambiarEstado.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Cancelar"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {t.estado === "resuelto" && (
                            <button
                              onClick={() =>
                                cambiarEstado.execute({ id: t.id, estado: "cerrado" })
                              }
                              disabled={cambiarEstado.isPending}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                              title="Cerrar"
                            >
                              <Lock className="h-4 w-4" />
                            </button>
                          )}
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
            <LifeBuoy className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay tickets de soporte
            </p>
          </div>
        )}
      </div>
    </div>
  );
}