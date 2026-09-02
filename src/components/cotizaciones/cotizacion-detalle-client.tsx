"use client";

import { fechaCorta } from "@/lib/formato";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  FileText,
  User,
  CalendarDays,
} from "lucide-react";
import {
  aprobarCotizacionAction,
  rechazarCotizacionAction,
  caducarCotizacionAction,
} from "@/lib/actions/cotizaciones-actions";
import { formatGs } from "@/lib/cotizaciones/calculos";
import type { CotizacionDTO } from "@/lib/cotizaciones/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "Pendiente",
  },
  aprobada: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "Aprobada",
  },
  rechazada: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "Rechazada",
  },
  caducada: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "Caducada",
  },
};

export function CotizacionDetalleClient({
  cotizacion,
}: {
  cotizacion: CotizacionDTO;
}) {
  const aprobar = useAction(aprobarCotizacionAction, {
    onSuccess: () => toast.success("Cotización aprobada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const rechazar = useAction(rechazarCotizacionAction, {
    onSuccess: () => toast.success("Cotización rechazada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const caducar = useAction(caducarCotizacionAction, {
    onSuccess: () => toast.success("Cotización marcada como caducada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const est =
    ESTADO_BADGE[cotizacion.estado as string] ?? {
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
      label: cotizacion.estado,
    };

  const esPendiente = cotizacion.estado === "pendiente";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/cotizaciones/listado"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {cotizacion.numero_cotizacion ?? "Cotización"}
              </h1>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${est.cls}`}
              >
                {est.label}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Detalle de la cotización
            </p>
          </div>
        </div>

        {esPendiente && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => aprobar.execute({ id: cotizacion.id, estado: "aprobada" })}
              disabled={aprobar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <Check className="h-4 w-4" /> Aprobar
            </button>
            <button
              onClick={() => rechazar.execute({ id: cotizacion.id, estado: "rechazada" })}
              disabled={rechazar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              <X className="h-4 w-4" /> Rechazar
            </button>
            <button
              onClick={() => caducar.execute({ id: cotizacion.id, estado: "caducada" })}
              disabled={caducar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Clock className="h-4 w-4" /> Caducar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <User className="h-4 w-4" /> Cliente
          </p>
          <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
            {cotizacion.cliente_nombre ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <CalendarDays className="h-4 w-4" /> Vigencia
          </p>
          <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
            {cotizacion.fecha_emision
              ? fechaCorta(cotizacion.fecha_emision)
              : "—"}
            {" · "}
            {cotizacion.fecha_vencimiento
              ? fechaCorta(cotizacion.fecha_vencimiento)
              : "sin vencimiento"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <FileText className="h-4 w-4" /> Total
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {formatGs(cotizacion.total)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Ítems
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Cant.</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {cotizacion.items.map((it) => (
                <tr
                  key={it.item_id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {it.producto_codigo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                    {it.producto_nombre}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {it.cantidad}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {formatGs(it.precio_unitario)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {formatGs(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="text-sm">
            <span className="text-zinc-500">Subtotal: </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {formatGs(cotizacion.subtotal)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-500">Descuento: </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {formatGs(cotizacion.descuento)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-500">Total: </span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {formatGs(cotizacion.total)}
            </span>
          </div>
        </div>

        {cotizacion.terms && (
          <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            <p className="font-medium text-zinc-500">Condiciones:</p>
            <p className="mt-1">{cotizacion.terms}</p>
          </div>
        )}
      </div>
    </div>
  );
}
