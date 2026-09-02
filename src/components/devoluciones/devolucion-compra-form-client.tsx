"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Save, Undo2 } from "lucide-react";
import { crearDevolucionCompraAction } from "@/lib/actions/devoluciones-actions";
import { calcularSubtotal, formatGs } from "@/lib/devoluciones/calculos";
import type { OcDTO } from "@/lib/compras/repository";

interface ItemLinea {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export function DevolucionCompraFormClient({
  ordenesCompra,
}: {
  ordenesCompra: OcDTO[];
}) {
  const router = useRouter();
  const [oc_id, setOcId] = useState("");
  const [proveedor_id, setProveedorId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [items, setItems] = useState<ItemLinea[]>([]);

  const crear = useAction(crearDevolucionCompraAction, {
    onSuccess: (res) => {
      toast.success("Devolución registrada");
      router.push(`/devoluciones/compras/${res.data?.id}`);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al guardar devolución"),
  });

  const ocSeleccionada = ordenesCompra.find((o) => o.id === oc_id) ?? null;
  const subtotal = useMemo(() => calcularSubtotal(items), [items]);

  const puedeGuardar = Boolean(
    oc_id &&
      proveedor_id &&
      motivo.trim().length >= 3 &&
      items.length > 0 &&
      items.every((i) => i.producto_id && i.cantidad > 0 && i.precio_unitario >= 0) &&
      subtotal > 0 &&
      !crear.isPending,
  );

  const seleccionarOc = (id: string) => {
    setOcId(id);
    const o = ordenesCompra.find((x) => x.id === id);
    if (o) {
      setProveedorId(o.proveedor_id ?? "");
      setItems(
        o.items
          .filter((it) => it.producto_id)
          .map((it) => ({
            producto_id: it.producto_id,
            cantidad: it.cantidad_recibida || it.cantidad,
            precio_unitario: it.unit_price,
          })),
      );
    } else {
      setProveedorId("");
      setItems([]);
    }
  };

  const actualizarItem = (idx: number, cambios: Partial<ItemLinea>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));

  const eliminarItem = (idx: number) =>
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));

  const handleSubmit = () => {
    if (!oc_id) {
      toast.warning("Selecciona una orden de compra");
      return;
    }
    crear.execute({
      orden_compra_id: oc_id,
      proveedor_id,
      motivo: motivo.trim(),
      items: items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/devoluciones/compras")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Nueva Devolución de Compra
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Selecciona la orden de compra y ajusta los ítems devueltos
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!puedeGuardar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Save className="h-4 w-4" />{" "}
          {crear.isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Orden de compra *
            </label>
            <select
              value={oc_id}
              onChange={(e) => seleccionarOc(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar OC...</option>
              {ordenesCompra.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numero_orden} · {o.proveedor_nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Motivo *
            </label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: mercadería dañada, error de cantidad..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        {ocSeleccionada && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Proveedor:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {ocSeleccionada.proveedor_nombre}
            </span>
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          <Undo2 className="h-4 w-4" /> Ítems devueltos
        </h2>

        {items.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Selecciona una orden de compra para cargar sus ítems.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((l, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center dark:border-zinc-800"
              >
                <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {ocSeleccionada?.items.find(
                    (it) => it.producto_id === l.producto_id,
                  )?.producto_nombre ?? "Producto"}
                </div>
                <input
                  type="number"
                  min={1}
                  value={l.cantidad}
                  onChange={(e) =>
                    actualizarItem(i, { cantidad: Number(e.target.value) || 0 })
                  }
                  placeholder="Cant."
                  className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={l.precio_unitario || ""}
                  onChange={(e) =>
                    actualizarItem(i, { precio_unitario: Number(e.target.value) || 0 })
                  }
                  placeholder="Precio"
                  className="w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {formatGs(l.cantidad * l.precio_unitario)}
                  </span>
                  <button
                    onClick={() => eliminarItem(i)}
                    disabled={items.length <= 1}
                    className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    title="Eliminar ítem"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="text-sm">
            <span className="text-zinc-500">Total a devolver: </span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {formatGs(subtotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
