"use client";

import { numero } from "@/lib/formato";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  Package,
  Search,
  Plus,
  Pencil,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  crearProductoAction,
  actualizarProductoAction,
  cambiarEstadoProductoAction,
} from "@/lib/actions/inventario-actions";
import { formatGs } from "@/lib/compras/calculos";
import { formatCantidad } from "@/lib/inventario/calculos";
import type { ProductoInventarioDTO } from "@/lib/inventario/repository";

const emptyForm = {
  codigo: "",
  nombre: "",
  descripcion: "",
  barcode: "",
  cate: "",
  subcate: "",
  precio_base: 0,
  purchase_cost: 0,
  stock_minimo: 3,
  stock_maximo: 100,
  activo: true,
};

export function ProductosClient({
  items,
  total,
  page,
  pageSize,
  busqueda: busquedaInicial,
}: {
  items: ProductoInventarioDTO[];
  total: number;
  page: number;
  pageSize: number;
  busqueda: string;
}) {
  const router = useRouter();
  const [busquedaInput, setBusquedaInput] = useState(busquedaInicial);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<ProductoInventarioDTO | null>(null);
  const [form, setForm] = useState(emptyForm);

  const crear = useAction(crearProductoAction, {
    onSuccess: () => {
      toast.success("Producto creado");
      setModal(null);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al crear producto"),
  });

  const editar = useAction(actualizarProductoAction, {
    onSuccess: () => {
      toast.success("Producto actualizado");
      setModal(null);
      setEditando(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar producto"),
  });

  const cambiarEstado = useAction(cambiarEstadoProductoAction, {
    onSuccess: () => toast.success("Estado actualizado"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buscar = (termino: string) => {
    const q = termino.trim();
    router.push(`/inventario/productos?busqueda=${encodeURIComponent(q)}&page=1`);
  };

  const irPagina = (p: number) => {
    if (p < 1 || p > totalPages) return;
    router.push(
      `/inventario/productos?busqueda=${encodeURIComponent(busquedaInicial)}&page=${p}`,
    );
  };

  const abrirCrear = () => {
    setForm(emptyForm);
    setEditando(null);
    setModal("crear");
  };

  const abrirEditar = (p: ProductoInventarioDTO) => {
    setEditando(p);
    setForm({
      codigo: p.codigo ?? "",
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      barcode: p.barcode ?? "",
      cate: p.cate ?? "",
      subcate: p.subcate ?? "",
      precio_base: p.precio_base,
      purchase_cost: p.purchase_cost,
      stock_minimo: p.stock_minimo,
      stock_maximo: p.stock_maximo,
      activo: p.activo ?? true,
    });
    setModal("editar");
  };

  const setCampo = (campo: keyof typeof emptyForm, valor: string | number | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = () => {
    if (!form.nombre.trim()) {
      toast.warning("El nombre del producto es obligatorio");
      return;
    }
    if (modal === "editar" && editando) {
      editar.execute({ id: editando.id, data: form });
    } else {
      crear.execute(form);
    }
  };

  const isPending = crear.isPending || editar.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Productos
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Catálogo de productos del inventario
            </p>
          </div>
        </div>
        <button
          onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nuevo Producto
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {busquedaInicial ? (
              <>
                {total} resultado{total !== 1 ? "s" : ""} para{" "}
                <span className="font-semibold">&ldquo;{busquedaInicial}&rdquo;</span>
              </>
            ) : (
              <>
                {numero(total)} producto{total !== 1 ? "s" : ""}
              </>
            )}
          </p>
          <div className="flex-1" />
          <div className="relative flex w-full sm:w-72">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o barcode..."
                value={busquedaInput}
                onChange={(e) => setBusquedaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscar(busquedaInput);
                }}
                className="w-full rounded-l-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
            <button
              onClick={() => buscar(busquedaInput)}
              className="rounded-r-lg border border-l-0 border-zinc-300 bg-zinc-100 px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Buscar
            </button>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th>
                  <th className="px-3 py-2 text-right font-medium">Mínimo</th>
                  <th className="px-3 py-2 text-right font-medium">Costo</th>
                  <th className="px-3 py-2 text-right font-medium">Precio</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                      {p.codigo ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {p.nombre}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.cate ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                      {formatCantidad(p.stock_total)}
                      {p.under_minimo && (
                        <span className="ml-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          bajo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                      {formatCantidad(p.stock_minimo)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                      {formatGs(p.purchase_cost)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                      {formatGs(p.precio_base)}
                    </td>
                    <td className="px-3 py-2">
                      {p.activo ? (
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          activo
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => abrirEditar(p)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            cambiarEstado.execute({
                              id: p.id,
                              activo: !(p.activo ?? true),
                            })
                          }
                          disabled={cambiarEstado.isPending}
                          className="rounded p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600"
                          title={p.activo ? "Desactivar" : "Activar"}
                        >
                          {p.activo ? (
                            <Power className="h-4 w-4" />
                          ) : (
                            <PowerOff className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              {busquedaInicial
                ? `Sin resultados para "${busquedaInicial}"`
                : "No hay productos registrados"}
            </p>
            {!busquedaInicial && (
              <button
                onClick={abrirCrear}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" /> Nuevo Producto
              </button>
            )}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => irPagina(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                onClick={() => irPagina(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {modal === "crear" ? "Nuevo Producto" : "Editar Producto"}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { campo: "codigo" as const, label: "Código", type: "text" },
                { campo: "nombre" as const, label: "Nombre *", type: "text" },
                { campo: "barcode" as const, label: "Código de barras", type: "text" },
                { campo: "cate" as const, label: "Categoría", type: "text" },
                { campo: "subcate" as const, label: "Subcategoría", type: "text" },
                { campo: "precio_base" as const, label: "Precio base", type: "number" },
                { campo: "purchase_cost" as const, label: "Costo de compra", type: "number" },
                { campo: "stock_minimo" as const, label: "Stock mínimo", type: "number" },
                { campo: "stock_maximo" as const, label: "Stock máximo", type: "number" },
              ].map((f) => (
                <div key={f.campo} className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    min={f.type === "number" ? 0 : undefined}
                    value={String(form[f.campo])}
                    onChange={(e) =>
                      setCampo(
                        f.campo,
                        f.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Descripción
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setCampo("descripcion", e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setModal(null);
                  setEditando(null);
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={isPending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}