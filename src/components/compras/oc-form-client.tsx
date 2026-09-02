"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  ShoppingCart,
} from "lucide-react";
import { crearOcAction, crearProductoCompraAction } from "@/lib/actions/compras-actions";
import {
  calcularSubtotal,
  calcularImpuestos,
  calcularTotal,
  formatGs,
} from "@/lib/compras/calculos";
import type {
  ProveedorDTO,
  ProductoCompraDTO,
} from "@/lib/compras/repository";

interface ItemLinea {
  producto_id: string;
  cantidad: number;
  unit_price: number;
}

const emptyLinea = (): ItemLinea => ({
  producto_id: "",
  cantidad: 1,
  unit_price: 0,
});

export function OcFormClient({
  proveedores,
  productos,
}: {
  proveedores: ProveedorDTO[];
  productos: ProductoCompraDTO[];
}) {
  const router = useRouter();
  const [proveedor_id, setProveedorId] = useState("");
  const [items, setItems] = useState<ItemLinea[]>([emptyLinea()]);
  const [is_tax_included, setIsTaxIncluded] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [productosExtra, setProductosExtra] = useState<ProductoCompraDTO[]>([]);
  const [lineaDestino, setLineaDestino] = useState(-1);
  const [modalCrearProducto, setModalCrearProducto] = useState(false);
  const [nombreProd, setNombreProd] = useState("");
  const [codigoProd, setCodigoProd] = useState("");
  const [barcodeProd, setBarcodeProd] = useState("");
  const [descProd, setDescProd] = useState("");
  const [precioVentaProd, setPrecioVentaProd] = useState(0);
  const [costoProd, setCostoProd] = useState(0);

  const crear = useAction(crearOcAction, {
    onSuccess: (res) => {
      toast.success("Orden de compra creada");
      router.push(`/compras/ordenes/${res.data?.id}`);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al guardar OC"),
  });

  const subtotal = useMemo(() => calcularSubtotal(items), [items]);
  const impuestos = useMemo(
    () => calcularImpuestos(subtotal, is_tax_included),
    [subtotal, is_tax_included],
  );
  const total = useMemo(
    () => calcularTotal(subtotal, impuestos, 0),
    [subtotal, impuestos],
  );

  const puedeGuardar = Boolean(
    proveedor_id &&
      items.length > 0 &&
      items.every((i) => i.producto_id && i.cantidad > 0 && i.unit_price >= 0) &&
      subtotal > 0 &&
      !crear.isPending,
  );

  const actualizarItem = (idx: number, cambios: Partial<ItemLinea>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));

  const agregarItem = () => setItems((p) => [...p, emptyLinea()]);

  const eliminarItem = (idx: number) =>
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));

  const todosProductos = useMemo(
    () => [...productos, ...productosExtra],
    [productos, productosExtra],
  );

  const crearProd = useAction(crearProductoCompraAction, {
    onSuccess: (res) => {
      const id = res.data?.id ?? "";
      if (!id) {
        toast.error("No se pudo crear el producto");
        return;
      }
      const costo = Number(costoProd) || 0;
      setProductosExtra((prev) => [
        ...prev,
        {
          id,
          codigo: codigoProd.trim() || null,
          nombre: nombreProd.trim(),
          barcode: barcodeProd.trim() || null,
          purchase_cost: costo,
          stock_total: 0,
          activo: true,
        },
      ]);
      if (lineaDestino >= 0) {
        actualizarItem(lineaDestino, { producto_id: id, unit_price: costo });
      }
      toast.success(`Producto "${nombreProd.trim()}" creado`);
      setModalCrearProducto(false);
      setNombreProd("");
      setCodigoProd("");
      setBarcodeProd("");
      setDescProd("");
      setPrecioVentaProd(0);
      setCostoProd(0);
      setLineaDestino(-1);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al crear producto"),
  });

  const confirmarCrearProducto = () => {
    if (!nombreProd.trim()) {
      toast.warning("El nombre del producto es obligatorio");
      return;
    }
    crearProd.execute({
      nombre: nombreProd.trim(),
      codigo: codigoProd.trim() || undefined,
      barcode: barcodeProd.trim() || undefined,
      descripcion: descProd.trim() || undefined,
      precio_base: Number(precioVentaProd) || 0,
      purchase_cost: Number(costoProd) || 0,
    });
  };

  const handleSubmit = () => {
    if (!proveedor_id) {
      toast.warning("Selecciona un proveedor");
      return;
    }
    if (items.some((i) => !i.producto_id)) {
      toast.warning("Todas las líneas deben tener un producto");
      return;
    }
    if (items.some((i) => i.cantidad <= 0)) {
      toast.warning("Las cantidades deben ser mayores a 0");
      return;
    }
    if (subtotal <= 0) {
      toast.warning("El subtotal debe ser mayor a 0");
      return;
    }
    crear.execute({
      proveedor_id,
      items: items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        unit_price: i.unit_price,
      })),
      is_tax_included,
      remarks: remarks.trim() || undefined,
      warehouse: warehouse.trim() || undefined,
    });
  };

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
              Nueva Orden de Compra
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Registrar una OC (se crea en borrador)
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
              Proveedor *
            </label>
            <select
              value={proveedor_id}
              onChange={(e) => setProveedorId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar proveedor...</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.supplier}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Depósito / almacén
            </label>
            <input
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Observaciones
            </label>
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Notas de la OC"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-3">
            <input
              type="checkbox"
              id="is_tax_included"
              checked={is_tax_included}
              onChange={(e) => setIsTaxIncluded(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <label
              htmlFor="is_tax_included"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Precios con IVA incluido
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            <ShoppingCart className="h-4 w-4" /> Ítems de la OC
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
                  const p = todosProductos.find((x) => x.id === id);
                  actualizarItem(i, {
                    producto_id: id,
                    unit_price: p ? Number(p.purchase_cost) : 0,
                  });
                }}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar producto...</option>
                {todosProductos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} - ` : ""}
                    {p.nombre} (stock: {p.stock_total})
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setLineaDestino(i);
                  setModalCrearProducto(true);
                }}
                className="shrink-0 rounded-lg border border-dashed border-zinc-400 px-2.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                title="Crear un producto nuevo y asociarlo a esta línea"
              >
                + Nuevo
              </button>
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
                value={l.unit_price || ""}
                onChange={(e) =>
                  actualizarItem(i, { unit_price: Number(e.target.value) || 0 })
                }
                placeholder="Precio"
                className="w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {formatGs(l.cantidad * l.unit_price)}
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

        {productos.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            No hay productos en el catálogo. Carga productos para poder registrar
            compras.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="text-sm text-right">
            <p className="text-zinc-500">
              Subtotal:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {formatGs(subtotal)}
              </span>
            </p>
            {impuestos > 0 && (
              <p className="text-zinc-500">
                IVA (10%):{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatGs(impuestos)}
                </span>
              </p>
            )}
            <p className="text-zinc-900 dark:text-zinc-50">
              <span className="text-sm text-zinc-500">Total: </span>
              <span className="text-lg font-semibold">{formatGs(total)}</span>
            </p>
          </div>
        </div>
      </div>

      {modalCrearProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Nuevo producto
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {lineaDestino >= 0
                ? `Se creará y asociará automáticamente a la línea ${lineaDestino + 1}.`
                : "Se agregará al catálogo de productos."}
            </p>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nombre *
                </label>
                <input
                  autoFocus
                  value={nombreProd}
                  onChange={(e) => setNombreProd(e.target.value)}
                  placeholder="Nombre del producto"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Código
                  </label>
                  <input
                    value={codigoProd}
                    onChange={(e) => setCodigoProd(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Barcode
                  </label>
                  <input
                    value={barcodeProd}
                    onChange={(e) => setBarcodeProd(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Precio de venta (₲)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={precioVentaProd || ""}
                    onChange={(e) =>
                      setPrecioVentaProd(Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Costo de compra (₲)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={costoProd || ""}
                    onChange={(e) => setCostoProd(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Descripción
                </label>
                <textarea
                  value={descProd}
                  onChange={(e) => setDescProd(e.target.value)}
                  rows={2}
                  placeholder="Opcional"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setModalCrearProducto(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCrearProducto}
                disabled={crearProd.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {crearProd.isPending ? "Creando..." : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
