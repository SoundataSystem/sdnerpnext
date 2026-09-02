"use client";

import { useMemo, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Truck, Search, Plus, Pencil } from "lucide-react";
import {
  crearProveedorAction,
  actualizarProveedorAction,
} from "@/lib/actions/compras-actions";
import type { ProveedorDTO } from "@/lib/compras/repository";

const emptyForm = {
  supplier: "",
  tax: "",
  phone: "",
  address: "",
  document_type: "RUC",
  term: "",
  condition_description: "",
  tiene_acuerdo_comercial: false,
};

export function ProveedoresClient({
  proveedores,
}: {
  proveedores: ProveedorDTO[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<ProveedorDTO | null>(null);
  const [form, setForm] = useState(emptyForm);

  const crear = useAction(crearProveedorAction, {
    onSuccess: () => {
      toast.success("Proveedor creado");
      setModal(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al crear proveedor"),
  });

  const editar = useAction(actualizarProveedorAction, {
    onSuccess: () => {
      toast.success("Proveedor actualizado");
      setModal(null);
      setEditando(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar proveedor"),
  });

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return proveedores;
    const q = busqueda.toLowerCase();
    return proveedores.filter(
      (p) =>
        p.supplier.toLowerCase().includes(q) ||
        p.tax?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q),
    );
  }, [proveedores, busqueda]);

  const abrirCrear = () => {
    setForm(emptyForm);
    setEditando(null);
    setModal("crear");
  };

  const abrirEditar = (p: ProveedorDTO) => {
    setEditando(p);
    setForm({
      supplier: p.supplier === "—" ? "" : p.supplier,
      tax: p.tax ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
      document_type: p.document_type ?? "RUC",
      term: p.term ?? "",
      condition_description: p.condition_description ?? "",
      tiene_acuerdo_comercial: p.tiene_acuerdo_comercial ?? false,
    });
    setModal("editar");
  };

  const setCampo = (campo: keyof typeof emptyForm, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = () => {
    if (!form.supplier.trim()) {
      toast.warning("El nombre del proveedor es obligatorio");
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
          <Truck className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Proveedores
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Registro de proveedores para las compras
            </p>
          </div>
        </div>
        <button
          onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nuevo Proveedor
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {proveedores.length} proveedores
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
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">RUC</th>
                  <th className="px-3 py-2 font-medium">Teléfono</th>
                  <th className="px-3 py-2 font-medium">Condición</th>
                  <th className="px-3 py-2 font-medium">Acuerdo</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {p.supplier}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.tax ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.condition_description ?? p.term ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.tiene_acuerdo_comercial ? "Sí" : "No"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => abrirEditar(p)}
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
            <Truck className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay proveedores registrados
            </p>
            <button
              onClick={abrirCrear}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nuevo Proveedor
            </button>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {modal === "crear" ? "Nuevo Proveedor" : "Editar Proveedor"}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { campo: "supplier" as const, label: "Nombre *", type: "text" },
                { campo: "tax" as const, label: "RUC", type: "text" },
                { campo: "phone" as const, label: "Teléfono", type: "text" },
                { campo: "document_type" as const, label: "Tipo documento", type: "text" },
                { campo: "term" as const, label: "Condición de pago", type: "text" },
                { campo: "condition_description" as const, label: "Condición", type: "text" },
              ].map((f) => (
                <div key={f.campo} className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={String(form[f.campo])}
                    onChange={(e) => setCampo(f.campo, e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Dirección
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setCampo("address", e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="tiene_acuerdo_comercial"
                  checked={form.tiene_acuerdo_comercial}
                  onChange={(e) =>
                    setCampo("tiene_acuerdo_comercial", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <label
                  htmlFor="tiene_acuerdo_comercial"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Tiene acuerdo comercial
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
