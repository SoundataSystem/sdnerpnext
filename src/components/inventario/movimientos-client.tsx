"use client";

import { fechaHora, numero } from "@/lib/formato";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Search, ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCantidad } from "@/lib/inventario/calculos";
import type { MovimientoInventarioDTO } from "@/lib/inventario/repository";

const TIPO_BADGE: Record<string, { cls: string; label: string }> = {
  entrada: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "entrada",
  },
  salida: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "salida",
  },
  ajuste: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "ajuste",
  },
  transferencia: {
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "transferencia",
  },
  devolucion: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "devolución",
  },
};

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "entrada", label: "Entradas" },
  { value: "salida", label: "Salidas" },
  { value: "ajuste", label: "Ajustes" },
  { value: "transferencia", label: "Transferencias" },
  { value: "devolucion", label: "Devoluciones" },
];

export function MovimientosClient({
  items,
  total,
  page,
  pageSize,
  tipo: tipoInicial,
  busqueda: busquedaInicial,
}: {
  items: MovimientoInventarioDTO[];
  total: number;
  page: number;
  pageSize: number;
  tipo: string;
  busqueda: string;
}) {
  const router = useRouter();
  const [busquedaInput, setBusquedaInput] = useState(busquedaInicial);
  const [filtroTipo, setFiltroTipo] = useState(tipoInicial);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const irPagina = (p: number) => {
    if (p < 1 || p > totalPages) return;
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (busquedaInicial) params.set("busqueda", busquedaInicial);
    if (tipoInicial !== "todos") params.set("tipo", tipoInicial);
    router.push(`/inventario/movimientos?${params.toString()}`);
  };

  const handleTipoChange = (nuevo: string) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (busquedaInicial) params.set("busqueda", busquedaInicial);
    if (nuevo !== "todos") params.set("tipo", nuevo);
    router.push(`/inventario/movimientos?${params.toString()}`);
  };

  const buscar = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (busquedaInput.trim()) params.set("busqueda", busquedaInput.trim());
    if (tipoInicial !== "todos") params.set("tipo", tipoInicial);
    router.push(`/inventario/movimientos?${params.toString()}`);
  };

  const FILTROS = [
    { value: "todos", label: "Todos" },
    { value: "entrada", label: "Entradas" },
    { value: "salida", label: "Salidas" },
    { value: "ajuste", label: "Ajustes" },
    { value: "transferencia", label: "Transferencias" },
    { value: "devolucion", label: "Devoluciones" },
  ];

  const TIPO_BADGE: Record<string, { cls: string; label: string }> = {
    entrada: {
      cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      label: "entrada",
    },
    salida: {
      cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      label: "salida",
    },
    ajuste: {
      cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
      label: "ajuste",
    },
    transferencia: {
      cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
      label: "transferencia",
    },
    devolucion: {
      cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      label: "devolución",
    },
  };

  const badge = (v: string | null) =>
    TIPO_BADGE[v ?? ""] ?? {
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
      label: v ?? "—",
    };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Movimientos de Inventario
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Historial de entradas y salidas de stock
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {busquedaInicial ? (
              <>
                {total} resultado{total !== 1 ? "s" : ""} para{" "}
                <span className="font-semibold">&ldquo;{busquedaInicial}&rdquo;</span>
              </>
            ) : (
              <>
                {numero(total)} movimiento{total !== 1 ? "s" : ""}
              </>
            )}
          </p>
          <div className="flex-1" />
          <div className="flex gap-2">
            <div className="relative flex w-full sm:w-72">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o referencia..."
                  value={busquedaInput}
                  onChange={(e) => setBusquedaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const params = new URLSearchParams();
                      params.set("page", "1");
                      if (e.currentTarget.value.trim())
                        params.set("busqueda", e.currentTarget.value.trim());
                      if (tipoInicial !== "todos")
                        params.set("tipo", tipoInicial);
                      router.push(`/inventario/movimientos?${params.toString()}`);
                    }
                  }}
                  className="w-full rounded-l-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>
              <button
                onClick={buscar}
                className="rounded-r-lg border border-l-0 border-zinc-300 bg-zinc-100 px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Buscar
              </button>
            </div>
            <select
              value={tipoInicial}
              onChange={(e) => handleTipoChange(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {FILTROS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 text-right font-medium">Cant.</th>
                  <th className="px-3 py-2 font-medium">Depósito</th>
                  <th className="px-3 py-2 font-medium">Referencia</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const b = badge(m.tipo);
                  const esEntrada = m.tipo === "entrada";
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {fechaHora(m.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${b.cls}`}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                        {m.producto_nombre ?? "—"}
                        {m.producto_codigo && (
                          <span className="ml-1 font-mono text-xs text-zinc-400">
                            {m.producto_codigo}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`flex items-center justify-end gap-1 font-medium ${
                            esEntrada
                              ? "text-emerald-600"
                              : m.tipo === "salida"
                                ? "text-red-600"
                                : "text-zinc-900 dark:text-zinc-50"
                          }`}
                        >
                          {esEntrada ? (
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                          ) : m.tipo === "salida" ? (
                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                          ) : null}
                          {m.tipo === "entrada" ? "+" : m.tipo === "salida" ? "-" : ""}
                          {formatCantidad(m.cantidad)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {m.deposito_destino ?? m.deposito_origen ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                        {m.referencia ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {m.motivo ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {m.usuario_nombre ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <History className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              {busquedaInicial
                ? `Sin resultados para "${busquedaInicial}"`
                : "No hay movimientos"}
            </p>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => irPagina(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                onClick={() => irPagina(page + 1)}
                disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}