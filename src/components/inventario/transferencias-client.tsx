"use client";

import { useMemo, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { crearTransferenciaAction } from "@/lib/actions/inventario-actions";
import { formatCantidad } from "@/lib/inventario/calculos";
import type {
  DepositoInventarioDTO,
  ProductoInventarioDTO,
  StockDepositoDTO,
  SerieDisponibleDTO,
} from "@/lib/inventario/repository";

interface ItemLinea {
  producto_id: string;
  cantidad: number;
  seriales: string[];
}

const emptyLinea = (): ItemLinea => ({
  producto_id: "",
  cantidad: 1,
  seriales: [],
});

export function TransferenciasClient({
  depositos,
  productos,
  stock,
  seriales,
}: {
  depositos: DepositoInventarioDTO[];
  productos: ProductoInventarioDTO[];
  stock: StockDepositoDTO[];
  seriales: SerieDisponibleDTO[];
}) {
  const [modal, setModal] = useState(false);
  const [origen_id, setOrigenId] = useState("");
  const [destino_id, setDestinoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [items, setItems] = useState<ItemLinea[]>([emptyLinea()]);

  const activos = depositos.filter((d) => d.activo !== false);

  const transferir = useAction(crearTransferenciaAction, {
    onSuccess: () => {
      toast.success("Transferencia realizada");
      setModal(false);
      setOrigenId("");
      setDestinoId("");
      setMotivo("");
      setItems([emptyLinea()]);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al transferir"),
  });

  const origen = activos.find((d) => d.id === origen_id);

  const disponible = (producto_id: string) =>
    stock.find(
      (s) => s.producto_id === producto_id && s.deposito_id === origen_id,
    )?.stock ?? 0;

  const serialesLinea = (producto_id: string) =>
    seriales.filter(
      (s) =>
        s.producto_id === producto_id &&
        (s.deposito ?? "") === (origen?.nombre ?? ""),
    );

  const actualizarItem = (idx: number, cambios: Partial<ItemLinea>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));

  const agregarItem = () => setItems((p) => [...p, emptyLinea()]);

  const eliminarItem = (idx: number) =>
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));

  const toggleSerial = (idx: number, serialId: string, activar: boolean) => {
    setItems((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = activar
          ? [...l.seriales, serialId]
          : l.seriales.filter((s) => s !== serialId);
        return { ...l, seriales: next, cantidad: next.length > 0 ? next.length : l.cantidad };
      }),
    );
  };

  const guardar = () => {
    if (!origen_id) {
      toast.warning("Selecciona el depósito origen");
      return;
    }
    if (!destino_id) {
      toast.warning("Selecciona el depósito destino");
      return;
    }
    if (origen_id === destino_id) {
      toast.warning("El depósito destino debe ser distinto del origen");
      return;
    }
    if (items.some((i) => !i.producto_id)) {
      toast.warning("Todas las líneas deben tener un producto");
      return;
    }
    if (items.some((i) => i.cantidad <= 0)) {
      toast.warning("Todas las cantidades deben ser mayores a 0");
      return;
    }
    transferir.execute({
      deposito_origen_id: origen_id,
      deposito_destino_id: destino_id,
      motivo: motivo.trim(),
      items: items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        seriales: i.seriales,
      })),
    });
  };

  const resumen = useMemo(
    () => items.reduce((acc, i) => acc + (i.producto_id ? i.cantidad : 0), 0),
    [items],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Transferencias entre Depósitos
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Mover stock entre depósitos (decrementa origen, incrementa destino)
            </p>
          </div>
        </div>
        <button
          onClick={() => setModal(true)}
          disabled={activos.length < 2 || productos.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nueva Transferencia
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {activos.length < 2 ? (
          <div className="py-12 text-center">
            <ArrowLeftRight className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              Se necesitan al menos 2 depósitos activos para transferir stock.
            </p>
          </div>
        ) : (
          <div className="py-8 text-center">
            <ArrowLeftRight className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              Las transferencias se registran como movimientos tipo
              &quot;transferencia&quot; y se reflejan en Stock por Depósito.
            </p>
            <button
              onClick={() => setModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nueva Transferencia
            </button>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Nueva Transferencia
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Depósito origen *
                </label>
                <select
                  value={origen_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    setOrigenId(id);
                    if (id === destino_id) setDestinoId("");
                    setItems((prev) => prev.map(() => emptyLinea()));
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {activos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Depósito destino *
                </label>
                <select
                  value={destino_id}
                  onChange={(e) => setDestinoId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {activos
                    .filter((d) => d.id !== origen_id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Motivo
                </label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: reabastecer salón"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">
                Ítems a transferir{" "}
                <span className="ml-1 text-xs text-zinc-400">
                  ({resumen} unidad{resumen === 1 ? "" : "es"})
                </span>
              </p>
              <button
                onClick={agregarItem}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" /> Agregar ítem
              </button>
            </div>

            <div className="mt-2 space-y-3">
              {items.map((l, i) => {
                const prod = productos.find((p) => p.id === l.producto_id);
                const disp = l.producto_id ? disponible(l.producto_id) : 0;
                const sers = l.producto_id ? serialesLinea(l.producto_id) : [];
                const sinSeriales = sers.length === 0;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={l.producto_id}
                        onChange={(e) => {
                          const id = e.target.value;
                          actualizarItem(i, {
                            producto_id: id,
                            cantidad: 1,
                            seriales: [],
                          });
                        }}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar producto...</option>
                        {productos.map((p) => {
                          const dispP = stock.find(
                            (s) =>
                              s.producto_id === p.id && s.deposito_id === origen_id,
                          )?.stock;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.codigo ? `${p.codigo} - ` : ""}
                              {p.nombre} (disp: {formatCantidad(dispP ?? 0)})
                            </option>
                          );
                        })}
                      </select>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-medium text-zinc-500">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={disp}
                            value={l.cantidad || ""}
                            onChange={(e) =>
                              actualizarItem(i, {
                                cantidad: Number(e.target.value) || 0,
                              })
                            }
                            className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm"
                          />
                        </div>
                        <span className="pt-4 text-xs text-zinc-400">
                          / {formatCantidad(disp)}
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

                    {prod && sers.length > 0 && (
                      <div className="mt-2">
                        <p className="mb-1 text-[11px] font-medium text-zinc-500">
                          Seriales disponibles en {origen?.nombre ?? ""} (
                          {sers.length}) — al elegirlos, la cantidad se ajusta a la
                          selección
                        </p>
                        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                          {sers.map((s) => (
                            <label
                              key={s.id}
                              className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                l.seriales.includes(s.id)
                                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={l.seriales.includes(s.id)}
                                onChange={(e) =>
                                  toggleSerial(i, s.id, e.target.checked)
                                }
                              />
                              {s.serial}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {sinSeriales && l.producto_id && (
                      <p className="mt-2 text-[11px] text-zinc-400">
                        Sin seriales activos en este depósito (movimiento sin
                        serial).
                      </p>
                    )}
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
                disabled={transferir.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <ArrowLeftRight className="h-4 w-4" />
                {transferir.isPending ? "Transfiriendo..." : "Transferir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
