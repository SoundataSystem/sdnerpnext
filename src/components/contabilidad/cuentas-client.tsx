"use client";

import { numero } from "@/lib/formato";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Wallet } from "lucide-react";
import { formatPyG } from "@/lib/contabilidad/calculos";
import { BUCKET_LABEL } from "@/lib/contabilidad/calculos";
import type {
  CuentaCobrarDTO,
  CuentaPagarDTO,
  ResumenCuentasDTO,
} from "@/lib/contabilidad/repository";
import type { BucketAntiguedad } from "@/lib/contabilidad/calculos";

type CuentaRow = CuentaCobrarDTO | CuentaPagarDTO;

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  parcial: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "parcial",
  },
  pagado: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "pagado",
  },
  cancelado: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    label: "cancelado",
  },
};

const BUCKET_BADGE: Record<BucketAntiguedad, string> = {
  corriente:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "1-30": "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "31-60":
    "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  "61-90":
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  "90+": "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
};

const BUCKETS: BucketAntiguedad[] = [
  "corriente",
  "1-30",
  "31-60",
  "61-90",
  "90+",
];

const FILTROS_ESTADO = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendientes" },
  { value: "parcial", label: "Parciales" },
];

export function CuentasClient({
  tipo,
  resumen,
  cuentas,
}: {
  tipo: "cobrar" | "pagar";
  resumen: ResumenCuentasDTO;
  cuentas: CuentaRow[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroBucket, setFiltroBucket] = useState("todos");

  const contraparte = (c: CuentaRow) =>
    "cliente_nombre" in c ? c.cliente_nombre : c.proveedor_nombre;
  const origen = (c: CuentaRow) =>
    "orden_numero" in c ? c.orden_numero : c.oc_numero;

  const resumenDelTipo =
    tipo === "cobrar"
      ? {
          pendiente: resumen.cxc_pendiente,
          vencido: resumen.cxc_vencido,
          total: resumen.cxc_total,
        }
      : {
          pendiente: resumen.cxp_pendiente,
          vencido: resumen.cxp_vencido,
          total: resumen.cxp_total,
        };

  const montoPorBucket = useMemo(() => {
    const map = new Map<BucketAntiguedad, number>();
    for (const c of cuentas) {
      if (c.estado === "pagado" || c.estado === "cancelado") continue;
      map.set(c.bucket, (map.get(c.bucket) ?? 0) + c.saldo_pendiente);
    }
    return map;
  }, [cuentas]);

  const filtradas = useMemo(() => {
    let items = cuentas;
    if (filtroEstado !== "todos")
      items = items.filter((c) => c.estado === filtroEstado);
    if (filtroBucket !== "todos")
      items = items.filter((c) => c.bucket === filtroBucket);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      items = items.filter(
        (c) =>
          contraparte(c).toLowerCase().includes(q) ||
          (origen(c) ?? "").toLowerCase().includes(q),
      );
    }
    return items;
  }, [cuentas, busqueda, filtroEstado, filtroBucket]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Cuentas por {tipo === "cobrar" ? "Cobrar" : "Pagar"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {tipo === "cobrar"
              ? "Saldos pendientes de clientes y antigüedad"
              : "Saldos pendientes a proveedores y antigüedad"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Saldo pendiente
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatPyG(resumenDelTipo.pendiente)}
          </p>
        </div>
        <div
          className={`rounded-2xl border bg-white p-5 dark:bg-zinc-950 ${
            resumenDelTipo.vencido > 0
              ? "border-red-200 dark:border-red-900"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Vencido</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              resumenDelTipo.vencido > 0
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {formatPyG(resumenDelTipo.vencido)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cuentas abiertas
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {numero(resumenDelTipo.total)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-500">Antigüedad de saldos</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BUCKETS.map((b) => (
            <button
              key={b}
              onClick={() =>
                setFiltroBucket(filtroBucket === b ? "todos" : b)
              }
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                filtroBucket === b
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
              }`}
            >
              <span>{BUCKET_LABEL[b]}</span>
              <span className="text-xs opacity-70">
                {formatPyG(montoPorBucket.get(b) ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {filtradas.length} cuenta(s)
          </p>
          <div className="flex-1" />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por cliente u orden..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {FILTROS_ESTADO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {filtradas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">
                    {tipo === "cobrar" ? "Cliente" : "Proveedor"}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {tipo === "cobrar" ? "Orden" : "OC"}
                  </th>
                  <th className="px-3 py-2 font-medium">Vencimiento</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Pagado</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Antigüedad</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const est =
                    ESTADO_BADGE[c.estado] ??
                    {
                      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                      label: c.estado,
                    };
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                        {contraparte(c)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-400">
                        {origen(c) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {c.fecha_vencimiento ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">
                        {formatPyG(c.monto_total)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">
                        {formatPyG(c.pagado)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          c.saldo_pendiente > 0
                            ? "text-zinc-900 dark:text-zinc-50"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatPyG(c.saldo_pendiente)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${est.cls}`}
                        >
                          {est.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${BUCKET_BADGE[c.bucket]}`}
                        >
                          {BUCKET_LABEL[c.bucket]}
                          {c.dias_vencido > 0
                            ? ` (${c.dias_vencido}d)`
                            : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Wallet className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay cuentas por {tipo === "cobrar" ? "cobrar" : "pagar"}
            </p>
            <Link
              href={tipo === "cobrar" ? "/ventas/ordenes" : "/compras/ordenes"}
              className="mt-4 inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Ir a {tipo === "cobrar" ? "ventas" : "compras"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
