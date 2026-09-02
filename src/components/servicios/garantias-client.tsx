"use client";

import { fechaCorta } from "@/lib/formato";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { ShieldCheck, Plus, Save, Check, X } from "lucide-react";
import {
  registrarGarantiaAction,
  validarGarantiaAction,
} from "@/lib/actions/servicios-actions";
import type { GarantiaDTO } from "@/lib/servicios/repository";
import type { OrdenDTO } from "@/lib/ventas/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  emitida: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "emitida",
  },
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  pendiente_validacion: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "en validación",
  },
  validada: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "validada",
  },
  activa: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "activa",
  },
  vencida: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "vencida",
  },
  rechazada: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "rechazada",
  },
};

export function GarantiasClient({
  garantias,
  ordenes,
}: {
  garantias: GarantiaDTO[];
  ordenes: OrdenDTO[];
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [orden_id, setOrdenId] = useState("");
  const [orden_producto_id, setOrdenProductoId] = useState("");
  const [producto_id, setProductoId] = useState("");
  const [serial, setSerial] = useState("");
  const [numero_factura, setNumeroFactura] = useState("");
  const [fecha_vencimiento, setFechaVencimiento] = useState("");
  const [condiciones, setCondiciones] = useState("");

  const crear = useAction(registrarGarantiaAction, {
    onSuccess: () => {
      toast.success("Garantía registrada");
      setMostrarForm(false);
      setSerial("");
      setOrdenProductoId("");
      setProductoId("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const validar = useAction(validarGarantiaAction, {
    onSuccess: () => toast.success("Garantía validada"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const ordenSeleccionada = ordenes.find((o) => o.id === orden_id) ?? null;

  const seleccionarOrden = (id: string) => {
    setOrdenId(id);
    setOrdenProductoId("");
    setProductoId("");
  };

  const puedeGuardar = Boolean(
    orden_id &&
      orden_producto_id &&
      serial.trim() &&
      fecha_vencimiento &&
      !crear.isPending,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Garantías
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {garantias.length} garantías registradas
            </p>
          </div>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {mostrarForm ? (
            "Ocultar formulario"
          ) : (
            <>
              <Plus className="h-4 w-4" /> Registrar Garantía
            </>
          )}
        </button>
      </div>

      {mostrarForm && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Orden de venta *
              </label>
              <select
                value={orden_id}
                onChange={(e) => seleccionarOrden(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.numero_orden} · {o.cliente_nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ítem vendido *
              </label>
              <select
                value={orden_producto_id}
                disabled={!ordenSeleccionada}
                onChange={(e) => {
                  const id = e.target.value;
                  const item = ordenSeleccionada?.items.find((it) => it.id === id);
                  setOrdenProductoId(id);
                  setProductoId(item?.producto_id ?? "");
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Seleccionar ítem...</option>
                {ordenSeleccionada?.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.producto_nombre} (x{it.cantidad})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Serial del producto *
              </label>
              <input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Número de serie"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                N° de factura
              </label>
              <input
                value={numero_factura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                placeholder="Factura asociada"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Vencimiento *
              </label>
              <input
                type="date"
                value={fecha_vencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Condiciones
              </label>
              <input
                value={condiciones}
                onChange={(e) => setCondiciones(e.target.value)}
                placeholder="Condiciones específicas"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() =>
                crear.execute({
                  orden_id,
                  orden_producto_id,
                  producto_id,
                  serial_producto: serial.trim(),
                  numero_factura,
                  fecha_vencimiento,
                  condiciones_especificas: condiciones,
                })
              }
              disabled={!puedeGuardar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Save className="h-4 w-4" />{" "}
              {crear.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {garantias.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Serial</th>
                  <th className="px-3 py-2 font-medium">Vencimiento</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {garantias.map((g) => {
                  const est =
                    ESTADO_BADGE[g.estado as string] ??
                    { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", label: g.estado };
                  return (
                    <tr
                      key={g.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                        {g.codigo_garantia}
                      </td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {g.cliente_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {g.producto_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {g.serial_producto}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {fechaCorta(g.fecha_vencimiento)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${est.cls}`}
                        >
                          {est.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {g.estado === "pendiente" ||
                          g.estado === "pendiente_validacion" ? (
                            <>
                              <button
                                onClick={() => validar.execute({ id: g.id, valida: true })}
                                disabled={validar.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Validar"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => validar.execute({ id: g.id, valida: false })}
                                disabled={validar.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Rechazar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
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
              No hay garantías registradas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}