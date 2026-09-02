"use client";

import { fechaHora } from "@/lib/formato";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  ActividadDTO,
  LogAuditoriaDTO,
  PaginadoDTO,
} from "@/lib/auditoria/repository";

const ACCION_BADGE: Record<string, string> = {
  creada:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  actualizada:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  aprobada:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rechazada:
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  eliminada:
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function AuditoriaClient({
  actividad,
  logs,
}: {
  actividad: PaginadoDTO<ActividadDTO>;
  logs: PaginadoDTO<LogAuditoriaDTO>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const { items: itemsActividad, page, totalPages } = actividad;

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    if (!q) return itemsActividad;
    return itemsActividad.filter(
      (a) =>
        a.usuario_nombre.toLowerCase().includes(q) ||
        a.entidad.toLowerCase().includes(q) ||
        a.accion.toLowerCase().includes(q) ||
        (a.detalle ?? "").toLowerCase().includes(q),
    );
  }, [itemsActividad, busqueda]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Auditoría y Actividad
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Registro de acciones de usuarios en el sistema
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center gap-3">
          <p className="text-sm font-medium text-zinc-500">
            {actividad.total} evento(s) en total
          </p>
          <div className="flex-1" />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por usuario, entidad..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm"
            />
          </div>
        </div>

        {filtrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                  <th className="px-3 py-2 font-medium">Entidad</th>
                  <th className="px-3 py-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => {
                  const cls =
                    ACCION_BADGE[a.accion] ??
                    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {fechaHora(a.created_at)}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                        {a.usuario_nombre}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}
                        >
                          {a.accion}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {a.entidad}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {a.detalle ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              Sin eventos de actividad registrados
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/auditoria?page=${page - 1}`}
                aria-disabled={page <= 1}
                className={`inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 ${
                  page <= 1 ? "pointer-events-none opacity-40" : ""
                }`}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Link>
              <Link
                href={`/auditoria?page=${page + 1}`}
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
      </div>

      {logs.total > 0 && (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Log de auditoría ({logs.total})
          </summary>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Tabla</th>
                  <th className="px-3 py-2 font-medium">Registro</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {logs.items.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-zinc-100 font-mono dark:border-zinc-800/60"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {fechaHora(l.created_at)}
                    </td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      {l.tabla_afectada}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {l.registro_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">{l.accion}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {l.usuario_id?.slice(0, 8) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
