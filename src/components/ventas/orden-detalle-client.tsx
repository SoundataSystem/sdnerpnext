"use client";

import { fechaCorta } from "@/lib/formato";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Package,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { formatGs } from "@/lib/ventas/calculos";
import { eliminarOrdenAction } from "@/lib/actions/ventas-actions";
import type { OrdenDTO } from "@/lib/ventas/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
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

const ESTADO_CAJA_BADGE: Record<string, { cls: string; label: string }> = {
  cobrado: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "cobrado",
  },
  parcial: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "parcial",
  },
  pendiente_envio: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "en caja",
  },
  facturado: {
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "facturado",
  },
  anulado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "anulado",
  },
};

export function OrdenDetalleClient({
  orden,
  esAdmin,
}: {
  orden: OrdenDTO;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [modalEliminar, setModalEliminar] = useState(false);
  const [motivo, setMotivo] = useState("");

  const eliminar = useAction(eliminarOrdenAction, {
    onSuccess: (res) => {
      toast.success(`Orden ${res.data?.numero_orden} eliminada`);
      router.replace("/ventas/ordenes");
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al eliminar la orden"),
  });

  const badge = (
    map: Record<string, { cls: string; label: string }>,
    v: string | null,
  ) =>
    map[v ?? ""] ?? {
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
      label: v ?? "—",
    };
  const est = badge(ESTADO_BADGE, orden.estado);
  const caja = badge(ESTADO_CAJA_BADGE, orden.estado_caja);
  const cobrable = orden.estado !== "cancelada" && orden.estado_caja !== "cobrado";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/ventas/ordenes")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {orden.numero_orden}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {orden.cliente_nombre} ·{" "}
              {fechaCorta(orden.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {orden.estado === "pendiente" && (
            <Link
              href={`/ventas/ordenes/${orden.id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          )}
          <Link
            href={`/ventas/ordenes/${orden.id}/ticket`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </Link>
          {cobrable && (
            <Link
              href="/ventas/caja"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Banknote className="h-4 w-4" /> Cobrar en Caja
            </Link>
          )}
          {esAdmin && (
            <button
              onClick={() => setModalEliminar(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${est.cls}`}
        >
          Orden {est.label}
        </span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${caja.cls}`}
        >
          Caja: {caja.label}
        </span>
        {orden.numero_factura && (
          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Factura: {orden.numero_factura}
          </span>
        )}
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
                <th className="px-3 py-2 font-medium">Serial</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {orden.items.map((it) => (
                <tr
                  key={it.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/60"
                >
                  <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                    {it.producto_nombre}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {it.producto_codigo ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {it.serial ?? "—"}
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
        <div className="mt-4 flex items-center justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="text-right">
            <p className="text-sm text-zinc-500">
              Subtotal: <span className="font-medium">{formatGs(orden.subtotal)}</span>
            </p>
            {orden.shipping_fee > 0 && (
              <p className="text-sm text-zinc-500">
                Delivery: <span className="font-medium">{formatGs(orden.shipping_fee)}</span>
              </p>
            )}
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Total: {formatGs(orden.total)}
            </p>
          </div>
        </div>
      </div>

      {orden.vendedor_nombre && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Vendedor: <span className="font-medium">{orden.vendedor_nombre}</span>
        </div>
      )}
      {(orden.sucursal || orden.moneda) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Sucursal: <span className="font-medium">{orden.sucursal ?? "—"}</span>{" "}
          · Moneda: <span className="font-medium">{orden.moneda}</span>
        </div>
      )}
      {orden.observaciones && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Observaciones: {orden.observaciones}
        </div>
      )}

      {modalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Eliminar orden {orden.numero_orden}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Se restituirá el stock y se registrará el motivo en
              eliminaciones_ordenes. Esta acción no se puede deshacer.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Motivo de la eliminación (obligatorio)..."
              className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setModalEliminar(false);
                  setMotivo("");
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!motivo.trim()) {
                    toast.warning("El motivo es obligatorio");
                    return;
                  }
                  eliminar.execute({ id: orden.id, motivo: motivo.trim() });
                }}
                disabled={eliminar.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {eliminar.isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}