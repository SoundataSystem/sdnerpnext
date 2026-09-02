"use client";

import { fechaCorta, numero } from "@/lib/formato";
import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { construirMovimientosLibroDiario } from "@/lib/contabilidad/calculos";
import type { AsientoDTO, CuentaDTO } from "@/lib/contabilidad/repository";

export function LibroDiarioClient({
  asientos,
  cuentas,
}: {
  asientos: AsientoDTO[];
  cuentas: CuentaDTO[];
}) {
  const [cuentaFiltro, setCuentaFiltro] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const movimientos = useMemo(
    () =>
      construirMovimientosLibroDiario(asientos, {
        cuentaId: cuentaFiltro || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      }),
    [asientos, cuentaFiltro, desde, hasta],
  );

  const cuentasActivas = useMemo(
    () => cuentas.filter((c) => c.nivel === 3),
    [cuentas],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Libro Diario
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Mayor de movimientos por cuenta
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-500">
            Cuenta
          </label>
          <select
            value={cuentaFiltro}
            onChange={(e) => setCuentaFiltro(e.target.value)}
            className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas las cuentas</option>
            {cuentasActivas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} - {c.nombre}
              </option>
            ))}
          </select>
        </div>
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
        <button
          onClick={() => {
            setCuentaFiltro("");
            setDesde("");
            setHasta("");
          }}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Limpiar
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {movimientos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">N° Asiento</th>
                  <th className="px-3 py-2 font-medium">Cuenta</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 text-right font-medium">Debe</th>
                  <th className="px-3 py-2 text-right font-medium">Haber</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {fechaCorta(m.fecha)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-400">
                      {m.numero_asiento}
                    </td>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                      <span className="font-mono text-xs text-zinc-400">
                        {m.cuenta_codigo}
                      </span>{" "}
                      {m.cuenta_nombre}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {m.concepto}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-800 dark:text-zinc-100">
                      {m.debe > 0 ? `₲ ${numero(m.debe)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-800 dark:text-zinc-100">
                      {m.haber > 0 ? `₲ ${numero(m.haber)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-zinc-500">
            No hay movimientos contables
          </div>
        )}
      </div>
    </div>
  );
}