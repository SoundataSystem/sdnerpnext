"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { calcularEstadoResultados, formatPyG } from "@/lib/contabilidad/calculos";
import type { AsientoDTO, CuentaDTO } from "@/lib/contabilidad/repository";

export function EstadoResultadosClient({
  asientos,
  cuentas,
}: {
  asientos: AsientoDTO[];
  cuentas: CuentaDTO[];
}) {
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split("T")[0];
  });
  const [hasta, setHasta] = useState(() =>
    new Date().toISOString().split("T")[0],
  );

  const { ingresos, gastos, totalIngresos, totalGastos, utilidad } = useMemo(
    () => calcularEstadoResultados(asientos, cuentas, { desde, hasta }),
    [asientos, cuentas, desde, hasta],
  );

  const utilidadPositiva = utilidad >= 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Estado de Resultados
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Pérdidas y Ganancias (P&L)
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-500">
            Desde
          </label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-500">
            Hasta
          </label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-emerald-700">Ingresos</h2>
          <div className="mt-3">
            {ingresos.length > 0 ? (
              ingresos.map((i) => (
                <div
                  key={i.cuenta.id}
                  className="flex justify-between border-b border-zinc-100 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {i.cuenta.codigo} - {i.cuenta.nombre}
                  </span>
                  <span className="font-medium text-emerald-700">
                    {formatPyG(i.total)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-zinc-400">
                Sin ingresos registrados
              </p>
            )}
            <div className="mt-2 flex justify-between border-t-2 border-emerald-300 pt-3 text-sm font-bold text-emerald-800">
              <span>Total Ingresos</span>
              <span>{formatPyG(totalIngresos)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-red-700">Gastos</h2>
          <div className="mt-3">
            {gastos.length > 0 ? (
              gastos.map((g) => (
                <div
                  key={g.cuenta.id}
                  className="flex justify-between border-b border-zinc-100 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {g.cuenta.codigo} - {g.cuenta.nombre}
                  </span>
                  <span className="font-medium text-red-700">
                    {formatPyG(g.total)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-zinc-400">
                Sin gastos registrados
              </p>
            )}
            <div className="mt-2 flex justify-between border-t-2 border-red-300 pt-3 text-sm font-bold text-red-800">
              <span>Total Gastos</span>
              <span>{formatPyG(totalGastos)}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border bg-white p-6 dark:bg-zinc-950 ${
          utilidadPositiva ? "border-emerald-300" : "border-red-300"
        }`}
      >
        <div
          className={`flex items-center justify-between ${
            utilidadPositiva ? "text-emerald-800" : "text-red-800"
          }`}
        >
          <span className="text-lg font-bold">
            {utilidadPositiva ? "Utilidad Neta" : "Pérdida Neta"}
          </span>
          <span className="text-2xl font-bold">
            {formatPyG(Math.abs(utilidad))}
          </span>
        </div>
      </div>
    </div>
  );
}