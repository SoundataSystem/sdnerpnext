"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Save, Undo2 } from "lucide-react";
import { crearDevolucionVentaAction } from "@/lib/actions/devoluciones-actions";
import { calcularSubtotal, formatGs } from "@/lib/devoluciones/calculos";
import type { OrdenDTO } from "@/lib/ventas/repository";

interface ItemLinea {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export function DevolucionVentaFormClient({
  ordenes,
}: {
  ordenes: OrdenDTO[];
}) {
  const router = useRouter();
  const [orden_id, setOrdenId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [items, setItems] = useState<ItemLinea[]>([]);

  const crear = useAction(crearDevolucionVentaAction, {
    onSuccess: (res) => {
      toast.success("Devolución registrada");
      router.push(`/devoluciones/ventas/${res.data?.id}`);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al guardar devolución"),
  });

  const ordenSeleccionada = ordenes.find((o) => o.id === orden_id) ?? null;
  const subtotal = useMemo(() => calcularSubtotal(items), [items]);

  const puedeGuardar = Boolean(
    orden_id &&
      motivo.trim().length >= 3 &&
      items.length > 0 &&
      items.every((i) => i.producto_id && i.cantidad > 0 && i.precio_unitario >= 0) &&
      subtotal > 0 &&
      !crear.isPending,
  );

  const seleccionarOrden = (id: string) => {
    setOrdenId(id);
    const o = ordenes.find((x) => x.id === id);
    if (o) {
      setItems(
        o.items.map((it) => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
        })),
      );
    } else {
      setItems([]);
    }
  };

  const actualizarItem = (idx: number, cambios: Partial<ItemLinea>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));

  const eliminarItem = (idx: number) =>
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));

  const handleSubmit = () => {
    if (!orden_id) {
      toast.warning("Selecciona una orden");
      return;
    }
    crear.execute({
      orden_id,
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
            onClick={() => router.push("/devoluciones/ventas")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Nueva Devolución de Venta
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Selecciona la orden y ajusta los ítems devueltos
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
              Orden de venta *
            </label>
            <select
              value={orden_id}
              onChange={(e) => seleccionarOrden(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar orden...</option>
              {ordenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numero_orden} · {o.cliente_nombre}
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
              placeholder="Ej: producto defectuoso, cambio de talla..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {ordenSeleccionada && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Cliente:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {ordenSeleccionada.cliente_nombre}
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
            Selecciona una orden para cargar sus ítems.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((l, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center dark:border-zinc-800"
              >
                <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {ordenSeleccionada?.items.find((it) => it.producto_id === l.producto_id)
                    ?.producto_nombre ?? "Producto"}
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
