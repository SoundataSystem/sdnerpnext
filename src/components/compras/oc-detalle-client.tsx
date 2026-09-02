"use client";

import { fechaCorta } from "@/lib/formato";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Send,
  CheckCircle,
  XCircle,
  Lock,
  Truck,
} from "lucide-react";
import {
  aprobarOcAction,
  enviarOcAction,
  cancelarOcAction,
  cerrarOcAction,
} from "@/lib/actions/compras-actions";
import { formatGs } from "@/lib/compras/calculos";
import type { OcDTO } from "@/lib/compras/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  borrador: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "borrador",
  },
  pendiente_aprobacion: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pend. aprobación",
  },
  aprobada: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "aprobada",
  },
  enviada: {
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "enviada",
  },
  recepcion_parcial: {
    cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    label: "recepción parcial",
  },
  recepcion_completa: {
    cls: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    label: "recepción completa",
  },
  pendiente_ingreso_stock: {
    cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    label: "pend. ingreso",
  },
  ingresada: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "ingresada",
  },
  cerrada: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "cerrada",
  },
  cancelada: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "cancelada",
  },
};

export function OcDetalleClient({ oc }: { oc: OcDTO }) {
  const router = useRouter();

  const aprobar = useAction(aprobarOcAction, {
    onSuccess: () => toast.success("OC aprobada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const enviar = useAction(enviarOcAction, {
    onSuccess: () => toast.success("OC enviada — CxP generada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const cancelar = useAction(cancelarOcAction, {
    onSuccess: () => toast.success("OC cancelada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const cerrar = useAction(cerrarOcAction, {
    onSuccess: () => toast.success("OC cerrada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const est = ESTADO_BADGE[oc.estado] ?? {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: oc.estado,
  };
  const enFlujoRecepcion =
    oc.estado === "enviada" ||
    oc.estado === "recepcion_parcial" ||
    oc.estado === "pendiente_ingreso_stock";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/compras/ordenes")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {oc.numero_orden}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {oc.proveedor_nombre ?? "—"} ·{" "}
              {fechaCorta(oc.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enFlujoRecepcion && (
            <Link
              href="/compras/recepciones"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Truck className="h-4 w-4" /> Recepción
            </Link>
          )}
          {oc.estado === "borrador" && (
            <button
              onClick={() => aprobar.execute({ id: oc.id })}
              disabled={aprobar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle className="h-4 w-4" /> Aprobar
            </button>
          )}
          {oc.estado === "aprobada" && (
            <button
              onClick={() => enviar.execute({ id: oc.id })}
              disabled={enviar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Enviar
            </button>
          )}
          {oc.estado === "ingresada" && (
            <button
              onClick={() => cerrar.execute({ id: oc.id })}
              disabled={cerrar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Lock className="h-4 w-4" /> Cerrar
            </button>
          )}
          {!["cancelada", "cerrada", "ingresada"].includes(oc.estado) && (
            <button
              onClick={() => cancelar.execute({ id: oc.id })}
              disabled={cancelar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
            >
              <XCircle className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${est.cls}`}
        >
          OC {est.label}
        </span>
        {oc.fecha_emision && (
          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Emitida: {oc.fecha_emision}
          </span>
        )}
        {oc.enviada_at && (
          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Enviada: {fechaCorta(oc.enviada_at)}
          </span>
        )}
        {oc.warehouse && (
          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Depósito: {oc.warehouse}
          </span>
        )}
        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {oc.is_tax_included ? "IVA incluido" : "IVA 10% + costo op."}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          <Package className="h-4 w-4" /> Ítems
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">Recibida</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {oc.items.map((it) => (
                <tr
                  key={it.item_id}
                  className="border-b border-zinc-100 dark:border-zinc-800/60"
                >
                  <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                    {it.producto_nombre}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {it.producto_codigo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {it.cantidad}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {it.cantidad_recibida}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {formatGs(it.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {formatGs(it.cantidad * it.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="text-right text-sm">
            <p className="text-zinc-500">
              Subtotal:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {formatGs(oc.subtotal)}
              </span>
            </p>
            {oc.impuestos > 0 && (
              <p className="text-zinc-500">
                Impuestos:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatGs(oc.impuestos)}
                </span>
              </p>
            )}
            {oc.costo_operativo > 0 && (
              <p className="text-zinc-500">
                Costo operativo:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatGs(oc.costo_operativo)}
                </span>
              </p>
            )}
            <p className="text-zinc-900 dark:text-zinc-50">
              <span className="text-sm text-zinc-500">Total: </span>
              <span className="text-lg font-semibold">{formatGs(oc.total)}</span>
            </p>
          </div>
        </div>
      </div>

      {oc.remarks && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Observaciones: {oc.remarks}
        </div>
      )}
    </div>
  );
}
