"use client";

import { fechaCorta } from "@/lib/formato";
import { useMemo, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Wallet, Search, Plus, XCircle, Banknote } from "lucide-react";
import {
  registrarPagoProveedorAction,
  anularPagoProveedorAction,
} from "@/lib/actions/compras-actions";
import { formatGs } from "@/lib/compras/calculos";
import type {
  PagoProveedorDTO,
  CuentaPagarDTO,
} from "@/lib/compras/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  parcial: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "parcial",
  },
  pagado: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "pagado",
  },
  cancelado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "cancelado",
  },
};

export function PagosClient({
  pagos,
  cuentas,
  metodosPago,
}: {
  pagos: PagoProveedorDTO[];
  cuentas: CuentaPagarDTO[];
  metodosPago: { id: string; nombre: string }[];
}) {
  const [busqueda, setBusqueda] = useState("");

  const [modalPago, setModalPago] = useState(false);
  const [ocSel, setOcSel] = useState("");
  const [monto, setMonto] = useState(0);
  const [metodo, setMetodo] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [referencia, setReferencia] = useState("");

  const [modalAnular, setModalAnular] = useState(false);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const pagar = useAction(registrarPagoProveedorAction, {
    onSuccess: () => {
      toast.success("Pago registrado");
      setModalPago(false);
      setOcSel("");
      setMonto(0);
      setMetodo("");
      setNumeroFactura("");
      setReferencia("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al registrar pago"),
  });

  const anular = useAction(anularPagoProveedorAction, {
    onSuccess: () => {
      toast.success("Pago anulado");
      setModalAnular(false);
      setMotivo("");
      setAnulandoId(null);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al anular"),
  });

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return pagos;
    const q = busqueda.toLowerCase();
    return pagos.filter(
      (p) =>
        p.oc_numero?.toLowerCase().includes(q) ||
        p.proveedor_nombre?.toLowerCase().includes(q) ||
        p.numero_factura?.toLowerCase().includes(q),
    );
  }, [pagos, busqueda]);

  const cuentasPagables = cuentas.filter(
    (c) => c.estado === "pendiente" || c.estado === "parcial",
  );
  const ocSelData = cuentasPagables.find((c) => c.oc_id === ocSel);

  const totales = useMemo(() => {
    return {
      saldo: cuentas.reduce((s, c) => s + Number(c.saldo_pendiente), 0),
      pagado: pagos.reduce((s, p) => s + Number(p.monto), 0),
      registrados: pagos.length,
    };
  }, [cuentas, pagos]);

  const abrirPago = () => {
    setModalPago(true);
    setOcSel("");
    setMonto(0);
    setMetodo(metodosPago[0]?.nombre ?? "efectivo");
    setNumeroFactura("");
    setReferencia("");
  };

  const registrar = () => {
    if (!ocSelData) {
      toast.warning("Selecciona una cuenta a pagar");
      return;
    }
    if (!monto || monto <= 0) {
      toast.warning("Ingresa un monto válido");
      return;
    }
    if (monto > ocSelData.saldo_pendiente) {
      toast.warning(
        `El monto supera el saldo pendiente (${formatGs(ocSelData.saldo_pendiente)})`,
      );
      return;
    }
    if (!metodo.trim()) {
      toast.warning("Selecciona un método de pago");
      return;
    }
    pagar.execute({
      oc_id: ocSelData.oc_id!,
      monto,
      metodo_pago: metodo,
      numero_factura: numeroFactura.trim() || undefined,
      referencia: referencia.trim() || undefined,
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
              Pagos a Proveedores
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Cuentas por pagar y pagos registrados
            </p>
          </div>
        </div>
        <button
          onClick={abrirPago}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Registrar Pago
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cuentas por pagar
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {cuentasPagables.length}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Saldo pendiente total
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatGs(totales.saldo)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Total pagado
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatGs(totales.pagado)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Ventana de cuentas por pagar
        </h2>
        {cuentas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">OC</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo</th>
                  <th className="px-3 py-2 font-medium">Vencimiento</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => {
                  const b = badge(c.estado);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/60"
                    >
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {c.proveedor_nombre}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-400">
                        {c.oc_numero ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                        {formatGs(c.monto_total)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {formatGs(c.saldo_pendiente)}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {c.fecha_vencimiento ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${b.cls}`}
                        >
                          {b.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">
            No hay cuentas por pagar.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {totales.registrados} pagos registrados
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
                  <th className="px-3 py-2 font-medium">OC</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                  <th className="px-3 py-2 font-medium">Método</th>
                  <th className="px-3 py-2 font-medium">Factura</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                      {p.oc_numero ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                      {p.proveedor_nombre ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                      {formatGs(p.monto)}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.metodo_pago ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.numero_factura ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.fecha_pago ?? fechaCorta(p.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => {
                            setAnulandoId(p.id);
                            setModalAnular(true);
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          title="Anular"
                        >
                          <XCircle className="h-4 w-4" />
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
            <Wallet className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">No hay pagos registrados</p>
            <button
              onClick={abrirPago}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Registrar Pago
            </button>
          </div>
        )}
      </div>

      {modalPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Registrar Pago
              </h2>
            </div>

            {cuentasPagables.length === 0 ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                No hay cuentas por pagar pendientes.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Cuenta por pagar *
                  </label>
                  <select
                    value={ocSel}
                    onChange={(e) => {
                      const c = cuentasPagables.find(
                        (x) => x.oc_id === e.target.value,
                      );
                      setOcSel(e.target.value);
                      setMonto(c?.saldo_pendiente ?? 0);
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar CxP...</option>
                    {cuentasPagables.map((c) => (
                      <option key={c.id} value={c.oc_id ?? ""}>
                        {c.oc_numero ?? "OC"} · {c.proveedor_nombre} · saldo{" "}
                        {formatGs(c.saldo_pendiente)}
                      </option>
                    ))}
                  </select>
                </div>

                {ocSelData && (
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                    <span className="text-zinc-500">Saldo pendiente</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatGs(ocSelData.saldo_pendiente)}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Monto a pagar *
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      N° Factura
                    </label>
                    <input
                      type="text"
                      value={numeroFactura}
                      onChange={(e) => setNumeroFactura(e.target.value)}
                      placeholder="Opcional"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Referencia
                    </label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      placeholder="Opcional"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setModalPago(false)}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registrar}
                    disabled={pagar.isPending}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {pagar.isPending ? "Pagando..." : "Registrar Pago"}
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
              Anular pago
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
                  setModalAnular(false);
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
    </div>
  );
}