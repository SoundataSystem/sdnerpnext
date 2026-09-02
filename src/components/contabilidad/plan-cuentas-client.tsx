"use client";

import { useMemo, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Pencil,
  Plus,
  FolderTree,
} from "lucide-react";
import { crearCuentaAction, actualizarCuentaAction } from "@/lib/actions/contabilidad-actions";
import type { CuentaDTO } from "@/lib/contabilidad/repository";

const TIPO_LABEL: Record<string, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  ingreso: "Ingreso",
  gasto: "Gasto",
};

interface TreeNode {
  cuenta: CuentaDTO;
  hijos: TreeNode[];
}

export function construirArbol(cuentas: CuentaDTO[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  cuentas.forEach((c) => map.set(c.id, { cuenta: c, hijos: [] }));
  const raices: TreeNode[] = [];
  map.forEach((node) => {
    const padre = node.cuenta.padre_id ? map.get(node.cuenta.padre_id) : null;
    if (padre) padre.hijos.push(node);
    else raices.push(node);
  });
  return raices;
}

export function PlanCuentasClient({ cuentas }: { cuentas: CuentaDTO[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    tipo: "activo" as CuentaDTO["tipo"],
    padre_id: "",
  });

  const crearCuenta = useAction(crearCuentaAction, {
    onSuccess: () => {
      crearCuenta.reset();
      toast.success("Cuenta creada");
      setModalOpen(false);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al crear cuenta"),
  });

  const actualizarCuenta = useAction(actualizarCuentaAction, {
    onSuccess: () => {
      actualizarCuenta.reset();
      toast.success("Cuenta actualizada");
      setModalOpen(false);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar"),
  });

  const arbol = useMemo(() => construirArbol(cuentas), [cuentas]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const openCrear = (padreId?: string) => {
    setEditId(null);
    setForm({
      codigo: "",
      nombre: "",
      tipo: "activo",
      padre_id: padreId ?? "",
    });
    setModalOpen(true);
  };

  const openEditar = (c: CuentaDTO) => {
    setEditId(c.id);
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      padre_id: c.padre_id ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      toast.warning("Código y nombre son obligatorios");
      return;
    }
    const data = {
      codigo: form.codigo,
      nombre: form.nombre,
      tipo: form.tipo,
      nivel: 0,
      padre_id: form.padre_id || null,
      activo: true,
    };
    if (editId) {
      actualizarCuenta.execute({ id: editId, data });
    } else {
      crearCuenta.execute(data);
    }
  };

  const renderNodos = (nodos: TreeNode[], profundidad = 0) => {
    return nodos.map((n) => {
      const estaExpandido = expanded.has(n.cuenta.id);
      const tieneHijos = n.hijos.length > 0;
      return (
        <div key={n.cuenta.id}>
          <div
            className="flex items-center gap-2 border-b border-zinc-100 py-2 text-sm dark:border-zinc-800"
            style={{ paddingLeft: `${profundidad * 24 + 8}px` }}
          >
            <button
              onClick={() => (tieneHijos ? toggleExpand(n.cuenta.id) : null)}
              className={
                tieneHijos
                  ? "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                  : "pointer-events-none text-zinc-300"
              }
              aria-label="Expandir"
            >
              {tieneHijos ? (
                estaExpandido ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : (
                <span className="inline-block w-4" />
              )}
            </button>
            <span className="w-20 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {n.cuenta.codigo}
            </span>
            <span className="flex-1 text-zinc-800 dark:text-zinc-100">
              {n.cuenta.nombre}
            </span>
            <span
              className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${
                n.cuenta.activo === false
                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {TIPO_LABEL[n.cuenta.tipo]}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => openCrear(n.cuenta.id)}
                className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="Crear cuenta hija"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
              <button
                onClick={() => openEditar(n.cuenta)}
                className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>
          {estaExpandido && renderNodos(n.hijos, profundidad + 1)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderTree className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Plan de Cuentas
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Catálogo de cuentas contables
            </p>
          </div>
        </div>
        <button
          onClick={() => openCrear()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nueva Cuenta
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-2 text-sm font-medium text-zinc-500">
          {cuentas.length} cuentas
        </p>
        {arbol.length > 0 ? (
          renderNodos(arbol)
        ) : (
          <div className="py-12 text-center text-sm text-zinc-400">
            No hay cuentas configuradas
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {editId ? "Editar Cuenta" : "Nueva Cuenta"}
            </h2>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Código *
                  </label>
                  <input
                    value={form.codigo}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, codigo: e.target.value }))
                    }
                    placeholder="1.1.01"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Tipo *
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        tipo: e.target.value as CuentaDTO["tipo"],
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(TIPO_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nombre *
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                  placeholder="Nombre de la cuenta"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              {editId && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Cuenta padre
                  </label>
                  <select
                    value={form.padre_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, padre_id: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Sin padre (raíz)</option>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} - {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={crearCuenta.isPending || actualizarCuenta.isPending}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {crearCuenta.isPending || actualizarCuenta.isPending
                    ? "Guardando..."
                    : editId
                      ? "Actualizar"
                      : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}