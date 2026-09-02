"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ClipboardList,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  crearAjusteStockAction,
  aprobarAjusteStockAction,
  rechazarAjusteStockAction,
} from "@/lib/actions/inventario-actions";
import { formatCantidad, diferenciaStock } from "@/lib/inventario/calculos";
import type {
  AjusteDTO,
  DepositoInventarioDTO,
  ProductoInventarioDTO,
} from "@/lib/inventario/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  aprobado: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "aprobado",
  },
  rechazado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "rechazado",
  },
};

const TIPOS = [
  { value: "inventario", label: "Inventario" },
  { value: "rotura", label: "Rotura" },
  { value: "vencimiento", label: "Vencimiento" },
  { value: "ajuste", label: "Ajuste" },
  { value: "robo", label: "Robo" },
];

interface ItemLinea {
  producto_id: string;
  stock_actual: number;
  stock_nuevo: number;
}

const emptyLinea = (): ItemLinea => ({
  producto_id: "",
  stock_actual: 0,
  stock_nuevo: 0,
});

export function AjustesClient({
  ajustes,
  depositos,
  productos,
  puedeAprobar,
}: {
  ajustes: AjusteDTO[];
  depositos: DepositoInventarioDTO[];
  productos: ProductoInventarioDTO[];
  puedeAprobar: boolean;
}) {
  const [modal, setModal] = useState(false);
  const [deposito_id, setDepositoId] = useState("");
  const [tipo, setTipo] = useState<
    "inventario" | "rotura" | "vencimiento" | "ajuste" | "robo"
  >("inventario");
  const [motivo, setMotivo] = useState("");
  const [items, setItems] = useState<ItemLinea[]>([emptyLinea()]);

  const crear = useAction(crearAjusteStockAction, {
    onSuccess: () => {
      toast.success("Ajuste creado (pendiente de aprobación)");
      setModal(false);
      setDepositoId("");
      setMotivo("");
      setItems([emptyLinea()]);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al crear ajuste"),
  });

  const aprobar = useAction(aprobarAjusteStockAction, {
    onSuccess: () => toast.success("Ajuste aprobado y aplicado a stock"),
    onError: (err) => toast.error(err.error.serverError ?? "Error al aprobar"),
  });

  const rechazar = useAction(rechazarAjusteStockAction, {
    onSuccess: () => toast.success("Ajuste rechazado"),
    onError: (err) => toast.error(err.error.serverError ?? "Error al rechazar"),
  });

  const actualizarItem = (idx: number, cambios: Partial<ItemLinea>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));

  const agregarItem = () => setItems((p) => [...p, emptyLinea()]);

  const eliminarItem = (idx: number) =>
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));

  const guardar = () => {
    if (!deposito_id) {
      toast.warning("Selecciona un depósito");
      return;
    }
    if (!motivo.trim()) {
      toast.warning("El motivo es obligatorio");
      return;
    }
    if (items.some((i) => !i.producto_id)) {
      toast.warning("Todas las líneas deben tener un producto");
      return;
    }
    if (items.every((i) => i.stock_nuevo === i.stock_actual)) {
      toast.warning("Ninguna línea cambia el stock");
      return;
    }
    crear.execute({
      deposito_id,
      tipo,
      motivo: motivo.trim(),
      items: items.map((i) => ({
        producto_id: i.producto_id,
        stock_actual: i.stock_actual,
        stock_nuevo: i.stock_nuevo,
      })),
    });
  };

  const badge = (v: string | null) =>
    ESTADO_BADGE[v ?? ""] ?? {
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
      label: v ?? "—",
    };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Ajustes de Stock
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Conteos y correcciones con aprobación
            </p>
          </div>
        </div>
        <button
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nuevo Ajuste
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {ajustes.length > 0 ? (
          <div className="space-y-4">
            {ajustes.map((a) => {
              const b = badge(a.estado);
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                          {a.numero_ajuste}
                        </p>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${b.cls}`}
                        >
                          {b.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {a.deposito_nombre} · {a.tipo} · {a.motivo}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {a.items.length} ítems · {a.fecha ?? ""}
                      </p>
                    </div>
                    {puedeAprobar && a.estado === "pendiente" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => aprobar.execute({ id: a.id })}
                          disabled={aprobar.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Aprobar
                        </button>
                        <button
                          onClick={() => rechazar.execute({ id: a.id })}
                          disabled={rechazar.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Rechazar
                        </button>
                      </div>
                    )}
                  </div>

                  {a.items.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                            <th className="px-2 py-1.5 font-medium">Producto</th>
                            <th className="px-2 py-1.5 text-right font-medium">Actual</th>
                            <th className="px-2 py-1.5 text-right font-medium">Nuevo</th>
                            <th className="px-2 py-1.5 text-right font-medium">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.items.map((it) => (
                            <tr
                              key={it.id}
                              className="border-b border-zinc-100 dark:border-zinc-800/60"
                            >
                              <td className="px-2 py-1.5 text-zinc-800 dark:text-zinc-100">
                                {it.producto_nombre}
                              </td>
                              <td className="px-2 py-1.5 text-right text-zinc-600">
                                {formatCantidad(it.stock_actual)}
                              </td>
                              <td className="px-2 py-1.5 text-right text-zinc-600">
                                {formatCantidad(it.stock_nuevo)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-50">
                                {it.diferencia > 0 ? "+" : ""}
                                {formatCantidad(it.diferencia)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">No hay ajustes registrados</p>
            <button
              onClick={() => setModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nuevo Ajuste
            </button>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Nuevo Ajuste de Stock
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Depósito *
                </label>
                <select
                  value={deposito_id}
                  onChange={(e) => setDepositoId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar depósito...</option>
                  {depositos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tipo *
                </label>
                <select
                  value={tipo}
                  onChange={(e) =>
                    setTipo(
                      e.target.value as
                        | "inventario"
                        | "rotura"
                        | "vencimiento"
                        | "ajuste"
                        | "robo",
                    )
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Motivo *
                </label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: conteo físico"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">Ítems del ajuste</p>
              <button
                onClick={agregarItem}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" /> Agregar ítem
              </button>
            </div>

            <div className="mt-2 space-y-2">
              {items.map((l, i) => {
                const prod = productos.find((p) => p.id === l.producto_id);
                const delta = diferenciaStock(l.stock_nuevo, l.stock_actual);
                return (
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
                          stock_actual: p?.stock_total ?? 0,
                          stock_nuevo: p?.stock_total ?? 0,
                        });
                      }}
                      className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar producto...</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo ? `${p.codigo} - ` : ""}
                          {p.nombre} (stock: {formatCantidad(p.stock_total)})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-medium text-zinc-500">
                          Actual
                        </label>
                        <input
                          type="number"
                          min={0}
                          readOnly
                          value={prod?.stock_total ?? l.stock_actual}
                          className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-medium text-zinc-500">
                          Nuevo
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={l.stock_nuevo || ""}
                          onChange={(e) =>
                            actualizarItem(i, {
                              stock_nuevo: Number(e.target.value) || 0,
                            })
                          }
                          className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm"
                        />
                      </div>
                      <span
                        className={`w-14 text-right text-xs font-semibold ${
                          delta > 0
                            ? "text-emerald-600"
                            : delta < 0
                              ? "text-red-600"
                              : "text-zinc-400"
                        }`}
                      >
                        {delta > 0 ? `+${formatCantidad(delta)}` : formatCantidad(delta)}
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
                );
              })}
            </div>

            {productos.length === 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                No hay productos en el catálogo.
              </p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setModal(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={crear.isPending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {crear.isPending ? "Guardando..." : "Guardar ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}