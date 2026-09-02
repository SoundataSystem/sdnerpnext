"use client";

import { fechaCorta } from "@/lib/formato";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Home, Plus, Save, Play, CheckCircle, XCircle } from "lucide-react";
import {
  crearInstalacionAction,
  cambiarEstadoInstalacionAction,
} from "@/lib/actions/servicios-actions";
import type { InstalacionDTO } from "@/lib/servicios/repository";
import type { TecnicoDTO } from "@/lib/servicios/repository";
import type { OrdenServicioDTO } from "@/lib/servicios/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  programada: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "programada",
  },
  en_curso: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "en curso",
  },
  completada: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "completada",
  },
  cancelada: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "cancelada",
  },
};

export function InstalacionesClient({
  instalaciones,
  tecnicos,
  ordenes,
}: {
  instalaciones: InstalacionDTO[];
  tecnicos: TecnicoDTO[];
  ordenes: OrdenServicioDTO[];
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [orden_servicio_id, setOrdenServicioId] = useState("");
  const [tecnico_id, setTecnicoId] = useState("");
  const [fecha_programada, setFecha] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [hora_inicio, setHoraInicio] = useState("");
  const [hora_fin, setHoraFin] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");

  const crear = useAction(crearInstalacionAction, {
    onSuccess: () => {
      toast.success("Instalación programada");
      setMostrarForm(false);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const cambiarEstado = useAction(cambiarEstadoInstalacionAction, {
    onSuccess: () => toast.success("Estado actualizado"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const puedeGuardar = Boolean(fecha_programada && !crear.isPending);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Instalaciones
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {instalaciones.length} instalaciones registradas
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
              <Plus className="h-4 w-4" /> Programar Instalación
            </>
          )}
        </button>
      </div>

      {mostrarForm && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Orden de servicio
              </label>
              <select
                value={orden_servicio_id}
                onChange={(e) => setOrdenServicioId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Sin orden...</option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.numero_orden} · {o.cliente_nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Técnico
              </label>
              <select
                value={tecnico_id}
                onChange={(e) => setTecnicoId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Sin técnico...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Fecha programada *
              </label>
              <input
                type="date"
                value={fecha_programada}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hora inicio
              </label>
              <input
                type="time"
                value={hora_inicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hora fin
              </label>
              <input
                type="time"
                value={hora_fin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ciudad
              </label>
              <input
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Asunción"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Dirección
              </label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dirección de la instalación"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() =>
                crear.execute({
                  orden_servicio_id: orden_servicio_id || "",
                  tecnico_id: tecnico_id || "",
                  fecha_programada,
                  hora_inicio,
                  hora_fin,
                  direccion_instalacion: direccion,
                  ciudad,
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
        {instalaciones.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Técnico</th>
                  <th className="px-3 py-2 font-medium">Ciudad</th>
                  <th className="px-3 py-2 font-medium">Dirección</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {instalaciones.map((i) => {
                  const est =
                    ESTADO_BADGE[i.estado as string] ??
                    { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", label: i.estado };
                  return (
                    <tr
                      key={i.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {fechaCorta(i.fecha_programada)}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {i.tecnico_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {i.ciudad ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {i.direccion ?? "—"}
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
                          {i.estado === "programada" && (
                            <button
                              onClick={() =>
                                cambiarEstado.execute({ id: i.id, estado: "en_curso" })
                              }
                              disabled={cambiarEstado.isPending}
                              className="rounded p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Iniciar"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {(i.estado === "programada" || i.estado === "en_curso") && (
                            <>
                              <button
                                onClick={() =>
                                  cambiarEstado.execute({ id: i.id, estado: "completada" })
                                }
                                disabled={cambiarEstado.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Completar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  cambiarEstado.execute({ id: i.id, estado: "cancelada" })
                                }
                                disabled={cambiarEstado.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Cancelar"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
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
            <Home className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay instalaciones programadas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}