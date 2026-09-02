"use client";

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { calcularBalance, formatPyG } from "@/lib/contabilidad/calculos";
import type { AsientoDTO, CuentaDTO } from "@/lib/contabilidad/repository";

function SeccionCuenta({
  titulo,
  items,
  total,
  colorClass,
}: {
  titulo: string;
  items: { cuenta: CuentaDTO; total: number }[];
  total: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className={`text-lg font-semibold ${colorClass}`}>{titulo}</h2>
      <div className="mt-3">
        {items.length > 0 ? (
          items.map((it) => (
            <div
              key={it.cuenta.id}
              className="flex justify-between border-b border-zinc-100 py-2 text-sm dark:border-zinc-800"
            >
              <span className="text-zinc-700 dark:text-zinc-300">
                {it.cuenta.codigo} - {it.cuenta.nombre}
              </span>
              <span className={`font-medium ${colorClass}`}>
                {formatPyG(it.total)}
              </span>
            </div>
          ))
        ) : (
          <p className="py-4 text-center text-sm text-zinc-400">
            Sin {titulo.toLowerCase()}
          </p>
        )}
        <div
          className={`mt-2 flex justify-between border-t-2 pt-3 text-sm font-bold ${colorClass}`}
          style={{ borderColor: "currentColor" }}
        >
          <span>Total {titulo}</span>
          <span>{formatPyG(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function BalanceGeneralClient({
  asientos,
  cuentas,
}: {
  asientos: AsientoDTO[];
  cuentas: CuentaDTO[];
}) {
  const [fechaCorte, setFechaCorte] = useState(() =>
    new Date().toISOString().split("T")[0],
  );

  const { activos, pasivos, patrimonio, totalActivos, totalPasivos, totalPatrimonio, cuadrado } =
    useMemo(
      () => calcularBalance(asientos, cuentas, fechaCorte),
      [asientos, cuentas, fechaCorte],
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Balance General
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Situación patrimonial
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-500">
            Fecha de corte
          </label>
          <input
            type="date"
            value={fechaCorte}
            onChange={(e) => setFechaCorte(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SeccionCuenta
          titulo="Activos"
          items={activos}
          total={totalActivos}
          colorClass="text-blue-700"
        />
        <SeccionCuenta
          titulo="Pasivos"
          items={pasivos}
          total={totalPasivos}
          colorClass="text-amber-700"
        />
        <SeccionCuenta
          titulo="Patrimonio"
          items={patrimonio}
          total={totalPatrimonio}
          colorClass="text-purple-700"
        />
      </div>

      <div className="rounded-2xl border border-emerald-300 bg-white p-6 dark:border-emerald-900 dark:bg-zinc-950">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <span className="text-sm text-zinc-500">Total Activos</span>
            <p className="text-xl font-bold text-blue-700">
              {formatPyG(totalActivos)}
            </p>
          </div>
          <div>
            <span className="text-sm text-zinc-500">
              Total Pasivos + Patrimonio
            </span>
            <p className="text-xl font-bold text-amber-700">
              {formatPyG(totalPasivos + totalPatrimonio)}
            </p>
          </div>
          <div className={cuadrado ? "text-emerald-700" : "text-red-600"}>
            <span className="text-sm text-zinc-500">Diferencia</span>
            <p className="text-xl font-bold">
              {formatPyG(Math.abs(totalActivos - (totalPasivos + totalPatrimonio)))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}