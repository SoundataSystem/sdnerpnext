"use client";

import { useMemo, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Warehouse, Search, Plus, Pencil } from "lucide-react";
import {
  crearDepositoAction,
  actualizarDepositoAction,
} from "@/lib/actions/inventario-actions";
import type { DepositoInventarioDTO } from "@/lib/inventario/repository";

const emptyForm = {
  nombre: "",
  columna_stock: "",
  activo: true,
};

export function DepositosClient({
  depositos,
}: {
  depositos: DepositoInventarioDTO[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<DepositoInventarioDTO | null>(null);
  const [form, setForm] = useState(emptyForm);

  const crear = useAction(crearDepositoAction, {
    onSuccess: () => {
      toast.success("Depósito creado");
      setModal(null);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al crear depósito"),
  });

  const editar = useAction(actualizarDepositoAction, {
    onSuccess: () => {
      toast.success("Depósito actualizado");
      setModal(null);
      setEditando(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar depósito"),
  });

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return depositos;
    const q = busqueda.toLowerCase();
    return depositos.filter(
      (d) =>
        d.nombre.toLowerCase().includes(q) ||
        d.columna_stock.toLowerCase().includes(q),
    );
  }, [depositos, busqueda]);

  const abrirCrear = () => {
    setForm(emptyForm);
    setEditando(null);
    setModal("crear");
  };

  const abrirEditar = (d: DepositoInventarioDTO) => {
    setEditando(d);
    setForm({
      nombre: d.nombre,
      columna_stock: d.columna_stock,
      activo: d.activo ?? true,
    });
    setModal("editar");
  };

  const setCampo = (campo: keyof typeof emptyForm, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = () => {
    if (!form.nombre.trim() || !form.columna_stock.trim()) {
      toast.warning("Nombre y columna de stock son obligatorios");
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
          <Warehouse className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Depósitos
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Depósitos y almacenes del inventario
            </p>
          </div>
        </div>
        <button
          onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nuevo Depósito
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {depositos.length} depósitos
          </p>
          <div className="flex-1" />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm"
            />
          </div>
        </div>

        {filtrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Depósito</th>
                  <th className="px-3 py-2 font-medium">Columna de stock</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {d.nombre}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {d.columna_stock}
                    </td>
                    <td className="px-3 py-2">
                      {d.activo ? (
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
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => abrirEditar(d)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
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
            <Warehouse className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">No hay depósitos registrados</p>
            <button
              onClick={abrirCrear}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nuevo Depósito
            </button>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {modal === "crear" ? "Nuevo Depósito" : "Editar Depósito"}
            </h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setCampo("nombre", e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Columna de stock *
                </label>
                <input
                  type="text"
                  value={form.columna_stock}
                  onChange={(e) => setCampo("columna_stock", e.target.value)}
                  placeholder="stock_almacen_principal"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deposito_activo"
                  checked={form.activo}
                  onChange={(e) => setCampo("activo", e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <label
                  htmlFor="deposito_activo"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Activo
                </label>
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