"use client";

import { numero } from "@/lib/formato";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCantidad } from "@/lib/inventario/calculos";
import type {
  StockDepositoDTO,
  DepositoInventarioDTO,
} from "@/lib/inventario/repository";

export function StockClient({
  items,
  total,
  page,
  pageSize,
  busqueda: busquedaInicial,
  depositoId: depositoIdInicial,
  depositos,
}: {
  items: StockDepositoDTO[];
  total: number;
  page: number;
  pageSize: number;
  busqueda: string;
  depositoId: string;
  depositos: DepositoInventarioDTO[];
}) {
  const router = useRouter();
  const [busquedaInput, setBusquedaInput] = useState(busquedaInicial);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (busquedaInicial) params.set("busqueda", busquedaInicial);
    if (depositoIdInicial !== "todos") params.set("depositoId", depositoIdInicial);
    router.push(`/inventario/stock?${params.toString()}`);
  };

  const handleDeposito = (nuevo: string) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (busquedaInicial) params.set("busqueda", busquedaInicial);
    if (nuevo !== "todos") params.set("depositoId", nuevo);
    router.push(`/inventario/stock?${params.toString()}`);
  };

  const buscar = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (busquedaInput.trim()) params.set("busqueda", busquedaInput.trim());
    if (depositoIdInicial !== "todos") params.set("depositoId", depositoIdInicial);
    router.push(`/inventario/stock?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Boxes className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Stock por Depósito
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Existencias de productos por depósito
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Productos con stock
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {numero(items.length)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Unidades en vista
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {numero(items.reduce((s, r) => s + r.stock, 0))}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <select
              value={depositoIdInicial}
              onChange={(e) => handleDeposito(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="todos">Todos los depósitos</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <div className="relative flex w-full sm:w-72">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={busquedaInput}
                onChange={(e) => setBusquedaInput(e.target.value)}
                onKeyDown={(e) => {
if (e.key === "Enter") {
                      const params = new URLSearchParams();
                      params.set("page", "1");
                      if (e.currentTarget.value.trim())
                        params.set("busqueda", e.currentTarget.value.trim());
                      if (depositoIdInicial !== "todos")
                        params.set("depositoId", depositoIdInicial);
                      router.push(`/inventario/stock?${params.toString()}`);
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
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Depósito</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {r.producto_nombre}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-400">
                      {r.producto_codigo ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {r.deposito_nombre}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                      {numero(r.stock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Boxes className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">No hay stock para la vista</p>
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
                onClick={() => goPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages}
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