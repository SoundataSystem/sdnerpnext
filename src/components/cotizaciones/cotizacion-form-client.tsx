"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, FileText } from "lucide-react";
import { crearCotizacionAction } from "@/lib/actions/cotizaciones-actions";
import { calcularSubtotal, calcularTotal, formatGs } from "@/lib/cotizaciones/calculos";
import type { ClienteDTO, ProductoVentaDTO } from "@/lib/ventas/repository";

interface ItemLinea {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

const emptyLinea = (): ItemLinea => ({
  producto_id: "",
  cantidad: 1,
  precio_unitario: 0,
});

export function CotizacionFormClient({
  clientes,
  productos,
  numeroPreview,
}: {
  clientes: ClienteDTO[];
  productos: ProductoVentaDTO[];
  numeroPreview: string;
}) {
  const router = useRouter();
  const [cliente_id, setClienteId] = useState("");
  const [fecha_emision, setFechaEmision] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [fecha_vencimiento, setFechaVencimiento] = useState("");
  const [is_tax_included, setIsTaxIncluded] = useState(true);
  const [descuento, setDescuento] = useState(0);
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<ItemLinea[]>([emptyLinea()]);

  const crear = useAction(crearCotizacionAction, {
    onSuccess: (res) => {
      const advertencias = res.data?.advertencias ?? [];
      if (advertencias.length) {
        for (const a of advertencias) toast.warning(a);
      } else {
        toast.success("Cotización creada");
      }
      router.push(`/cotizaciones/${res.data?.id}`);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al guardar cotización"),
  });

  const subtotal = useMemo(() => calcularSubtotal(items), [items]);
  const total = useMemo(() => calcularTotal(subtotal, descuento), [subtotal, descuento]);

  const puedeGuardar = Boolean(
    cliente_id &&
      fecha_emision &&
      items.length > 0 &&
      items.every((i) => i.producto_id && i.cantidad > 0 && i.precio_unitario >= 0) &&
      subtotal > 0 &&
      !crear.isPending,
  );

  const actualizarItem = (idx: number, cambios: Partial<ItemLinea>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));

  const agregarItem = () => setItems((p) => [...p, emptyLinea()]);

  const eliminarItem = (idx: number) =>
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));

  const handleSubmit = () => {
    if (!cliente_id) {
      toast.warning("Selecciona un cliente");
      return;
    }
    if (items.some((i) => !i.producto_id)) {
      toast.warning("Todas las líneas deben tener un producto");
      return;
    }
    crear.execute({
      cliente_id,
      fecha_emision,
      fecha_vencimiento: fecha_vencimiento || "",
      is_tax_included,
      terms: terms.trim(),
      descuento,
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
            onClick={() => router.push("/cotizaciones/listado")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Nueva Cotización
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {numeroPreview} · Se asigna automáticamente al guardar
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cliente *
            </label>
            <select
              value={cliente_id}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido} · {c.cedula}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fecha de emisión
            </label>
            <input
              type="date"
              value={fecha_emision}
              onChange={(e) => setFechaEmision(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Válida hasta
            </label>
            <input
              type="date"
              value={fecha_vencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Descuento (₲)
            </label>
            <input
              type="number"
              min={0}
              value={descuento || ""}
              onChange={(e) => setDescuento(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Términos y condiciones
            </label>
            <input
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Condiciones de la cotización"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={is_tax_included}
                onChange={(e) => setIsTaxIncluded(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Precios incluyen impuestos
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            <FileText className="h-4 w-4" /> Ítems de la cotización
          </h2>
          <button
            onClick={agregarItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" /> Agregar ítem
          </button>
        </div>

        <div className="space-y-2">
          {items.map((l, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center dark:border-zinc-800"
            >
              <select
                value={l.producto_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const p = productos.find((x) => x.id === id);
                  actualizarItem(i, {
                    producto_id: id,
                    precio_unitario: p ? Number(p.precio_base) : 0,
                  });
                }}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar producto...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} - ` : ""}
                    {p.nombre} (stock: {p.stock_total})
                  </option>
                ))}
              </select>
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

        <div className="mt-4 flex flex-wrap items-center justify-end gap-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="text-sm">
            <span className="text-zinc-500">Subtotal: </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {formatGs(subtotal)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-500">Descuento: </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {formatGs(descuento)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-500">Total: </span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {formatGs(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
