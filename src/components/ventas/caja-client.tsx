"use client";

import { fechaCorta, numero } from "@/lib/formato";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  Wallet,
  Search,
  Plus,
  XCircle,
  Banknote,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  registrarCobroAction,
  anularCajaMovimientoAction,
  facturarCajaMovimientoAction,
} from "@/lib/actions/ventas-actions";
import { formatGs } from "@/lib/ventas/calculos";
import type {
  CajaMovimientoDTO,
  OrdenCobrableDTO,
} from "@/lib/ventas/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  cobrado: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "cobrado",
  },
  facturado: {
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "facturado",
  },
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  anulado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "anulado",
  },
};

export function CajaClient({
  items,
  total,
  page,
  pageSize,
  busqueda: busquedaInicial,
  estado: estadoInicial,
  metodosPago,
  ordenesCobrables,
}: {
  items: CajaMovimientoDTO[];
  total: number;
  page: number;
  pageSize: number;
  busqueda: string;
  estado: string;
  metodosPago: { id: string; nombre: string }[];
  ordenesCobrables: OrdenCobrableDTO[];
}) {
  const router = useRouter();
  const [busquedaInput, setBusquedaInput] = useState(busquedaInicial);
  const [estadoSel, setEstadoSel] = useState(estadoInicial);

  const [modalCobro, setModalCobro] = useState(false);
  const [ordenSel, setOrdenSel] = useState("");
  const [monto, setMonto] = useState(0);
  const [metodo, setMetodo] = useState("");
  const [factura, setFactura] = useState("");

  const [modalAnular, setModalAnular] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const [modalFacturar, setModalFacturar] = useState(false);
  const [facturarId, setFacturarId] = useState<string | null>(null);
  const [facturaNro, setFacturaNro] = useState("");

  const cobrar = useAction(registrarCobroAction, {
    onSuccess: () => {
      // Nueva clave para el próximo cobro (la usada ya fue consumida).
      claveCobro.current = crypto.randomUUID();
      toast.success("Cobro registrado");
      setModalCobro(false);
      setOrdenSel("");
      setMonto(0);
      setMetodo("");
      setFactura("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al registrar cobro"),
  });

  // Clave de idempotencia por intención de cobro: doble click / retry del
  // mismo envío reutilizan la clave → el servidor registra exactamente un pago.
  const claveCobro = useRef<string>(crypto.randomUUID());

  const facturar = useAction(facturarCajaMovimientoAction, {
    onSuccess: () => {
      toast.success("Movimiento facturado");
      setModalFacturar(false);
      setFacturarId(null);
      setFacturaNro("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al facturar"),
  });

  const anular = useAction(anularCajaMovimientoAction, {
    onSuccess: () => {
      toast.success("Movimiento anulado");
      setModalAnular(null);
      setMotivo("");
      setAnulandoId(null);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al anular"),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const irPagina = (p: number) => {
    if (p < 1 || p > totalPages) return;
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (busquedaInicial) params.set("busqueda", busquedaInicial);
    if (estadoInicial !== "todos") params.set("estado", estadoInicial);
    router.push(`/ventas/caja?${params.toString()}`);
  };

  const handleEstadoChange = (nuevo: string) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (busquedaInicial) params.set("busqueda", busquedaInicial);
    if (nuevo !== "todos") params.set("estado", nuevo);
    router.push(`/ventas/caja?${params.toString()}`);
  };

  const buscar = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (busquedaInput.trim()) params.set("busqueda", busquedaInput.trim());
    if (estadoInicial !== "todos") params.set("estado", estadoInicial);
    router.push(`/ventas/caja?${params.toString()}`);
  };

  const ordenSelData = ordenesCobrables.find((o) => o.id === ordenSel);

  const totales = useMemo(() => {
    const cobrados = items.filter((m) => m.estado !== "anulado");
    return {
      ingresos: cobrados.reduce((s, m) => s + (m.monto_pagado ?? 0), 0),
      movimientos: cobrados.length,
    };
  }, [items]);

  const abrirCobro = (o?: OrdenCobrableDTO) => {
    setModalCobro(true);
    if (o) {
      setOrdenSel(o.id);
      setMonto(o.saldo);
    } else {
      setOrdenSel("");
      setMonto(0);
    }
    setMetodo(metodosPago[0]?.nombre ?? "efectivo");
    setFactura("");
  };

  const registrar = () => {
    if (!ordenSelData) {
      toast.warning("Selecciona una orden a cobrar");
      return;
    }
    if (!monto || monto <= 0) {
      toast.warning("Ingresa un monto válido");
      return;
    }
    if (monto > ordenSelData.saldo) {
      toast.warning(`El monto supera el saldo pendiente (${formatGs(ordenSelData.saldo)})`);
      return;
    }
    if (!metodo.trim()) {
      toast.warning("Selecciona un método de pago");
      return;
    }
    cobrar.execute({
      clave_idempotencia: claveCobro.current,
      orden_id: ordenSelData.id,
      monto_pagado: monto,
      metodo_pago: metodo,
      numero_factura: factura.trim() || undefined,
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
          <Wallet className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Caja
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Cobros y movimientos de caja
            </p>
          </div>
        </div>
        <button
          onClick={() => abrirCobro()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Registrar Cobro
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ingresos de caja
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatGs(totales.ingresos)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Movimientos
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {totales.movimientos}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {busquedaInicial || estadoInicial !== "todos" ? (
              <>
                {total} resultado{total !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                {numero(total)} movimiento{total !== 1 ? "s" : ""}
              </>
            )}
          </p>
          <div className="flex-1" />
          <div className="flex gap-2">
            <div className="relative flex w-full sm:w-72">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por orden, cliente o factura..."
                  value={busquedaInput}
                  onChange={(e) => setBusquedaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const params = new URLSearchParams();
                      params.set("page", "1");
                      if (e.currentTarget.value.trim())
                        params.set("busqueda", e.currentTarget.value.trim());
                      if (estadoInicial !== "todos")
                        params.set("estado", estadoInicial);
                      router.push(`/ventas/caja?${params.toString()}`);
                    }
                  }}
                  className="w-full rounded-l-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>
              <button
                onClick={buscar}
                className="rounded-r-lg border border-l-0 border-zinc-300 bg-zinc-100 px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Buscar
              </button>
            </div>
            <select
              value={estadoInicial}
              onChange={(e) => handleEstadoChange(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="cobrado">Cobrado</option>
              <option value="facturado">Facturado</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Orden</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">Pagado</th>
                  <th className="px-3 py-2 font-medium">Método</th>
                  <th className="px-3 py-2 font-medium">Factura</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const b = badge(m.estado);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                        {m.orden_numero ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {m.cliente_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {formatGs(m.monto_pagado)}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {m.metodo_pago ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {m.numero_factura ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {m.fecha_cobro
                          ? fechaCorta(m.fecha_cobro)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${b.cls}`}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center">
                          {m.estado === "cobrado" && (
                            <>
                              <button
                                onClick={() => {
                                  setFacturarId(m.id);
                                  setFacturaNro("");
                                  setModalFacturar(true);
                                }}
                                className="rounded p-1.5 text-zinc-400 hover:bg-violet-50 hover:text-violet-600"
                                title="Facturar"
                              >
                                <ReceiptText className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setAnulandoId(m.id);
                                  setModalAnular(m.id);
                                }}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Anular"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Wallet className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              {busquedaInicial
                ? `Sin resultados para "${busquedaInicial}"`
                : "No hay movimientos de caja"}
            </p>
            <button
              onClick={() => abrirCobro()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Registrar Cobro
            </button>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
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
                disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalCobro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Registrar Cobro
              </h2>
            </div>

            {ordenesCobrables.length === 0 ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                No hay órdenes pendientes de cobro.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Orden *
                  </label>
                  <select
                    value={ordenSel}
                    onChange={(e) => {
                      const o = ordenesCobrables.find((x) => x.id === e.target.value);
                      setOrdenSel(e.target.value);
                      setMonto(o?.saldo ?? 0);
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar orden...</option>
                    {ordenesCobrables.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.numero_orden} · {o.cliente_nombre} · saldo{" "}
                        {formatGs(o.saldo)}
                      </option>
                    ))}
                  </select>
                </div>

                {ordenSelData && (
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                    <span className="text-zinc-500">Saldo pendiente</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatGs(ordenSelData.saldo)}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Monto a cobrar *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={monto || ""}
                    onChange={(e) => setMonto(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Método de pago *
                  </label>
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    {metodosPago.length > 0 ? (
                      metodosPago.map((m) => (
                        <option key={m.id} value={m.nombre}>
                          {m.nombre}
                        </option>
                      ))
                    ) : (
                      <option value="efectivo">efectivo</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    N° Factura
                  </label>
                  <input
                    type="text"
                    value={factura}
                    onChange={(e) => setFactura(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setModalCobro(false);
                      setOrdenSel("");
                    }}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registrar}
                    disabled={cobrar.isPending}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {cobrar.isPending ? "Cobrando..." : "Cobrar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Anular movimiento
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Indica el motivo de anulación (obligatorio)
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Motivo..."
              className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setModalAnular(null);
                  setMotivo("");
                  setAnulandoId(null);
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!anulandoId) return;
                  if (!motivo.trim()) {
                    toast.warning("El motivo es obligatorio");
                    return;
                  }
                  anular.execute({ id: anulandoId, motivo: motivo.trim() });
                }}
                disabled={anular.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {anular.isPending ? "Anulando..." : "Anular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalFacturar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <ReceiptText className="h-5 w-5 text-violet-600" /> Facturar
              movimiento
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Carga el número de factura para marcar el movimiento como
              facturado
            </p>
            <input
              type="text"
              value={facturaNro}
              onChange={(e) => setFacturaNro(e.target.value)}
              placeholder="N° de factura (obligatorio)"
              className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setModalFacturar(false);
                  setFacturarId(null);
                  setFacturaNro("");
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!facturarId) return;
                  if (!facturaNro.trim()) {
                    toast.warning("El número de factura es obligatorio");
                    return;
                  }
                  facturar.execute({
                    id: facturarId,
                    numero_factura: facturaNro.trim(),
                  });
                }}
                disabled={facturar.isPending}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
              >
                {facturar.isPending ? "Facturando..." : "Facturar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}