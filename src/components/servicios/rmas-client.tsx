"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  PackageX,
  Plus,
  Save,
  Check,
  X,
  Stethoscope,
  Wrench,
  Lock,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { crearRmaAction, avanzarRmaAction } from "@/lib/actions/servicios-actions";
import type { RmaDTO } from "@/lib/servicios/repository";
import type { AvanzarRmaInput, Prioridad, TipoRma } from "@/lib/servicios/schema";
import type { ClienteDTO, ProductoVentaDTO } from "@/lib/ventas/repository";

type AccionAvance = Pick<AvanzarRmaInput, "accion"> &
  Partial<Omit<AvanzarRmaInput, "accion" | "id">>;

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  recibido: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "recibido",
  },
  en_diagnostico: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "en diagnóstico",
  },
  diagnosticado: {
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "diagnosticado",
  },
  resuelto: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "resuelto",
  },
  cerrado: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "cerrado",
  },
  rechazado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "rechazado",
  },
  cancelado: {
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "cancelado",
  },
};

const TIPOS_RMA = [
  { value: "garantia", label: "Garantía" },
  { value: "producto_defectuoso", label: "Producto defectuoso" },
  { value: "producto_incorrecto", label: "Producto incorrecto" },
  { value: "danio_transporte", label: "Daño en transporte" },
  { value: "error_venta", label: "Error de venta" },
  { value: "cambio_comercial", label: "Cambio comercial" },
  { value: "devolucion_cliente", label: "Devolución de cliente" },
  { value: "reparacion", label: "Reparación" },
  { value: "otro", label: "Otro" },
];

const RESULTADOS = [
  "falla_confirmada",
  "falla_no_reproducible",
  "danio_fisico",
  "mal_uso",
  "producto_incompleto",
  "fuera_garantia",
  "garantia_valida",
  "garantia_rechazada",
  "sin_falla",
];

const RESOLUCIONES = [
  "reparar",
  "reemplazar_mismo",
  "reemplazar_diferente",
  "devolver_dinero",
  "nota_credito",
  "cambiar_producto",
  "devolver_proveedor",
  "rechazar_garantia",
  "devolver_sin_reparacion",
  "otro",
];

export function RmasClient({
  rmas,
  clientes,
  productos,
}: {
  rmas: RmaDTO[];
  clientes: ClienteDTO[];
  productos: ProductoVentaDTO[];
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [cliente_id, setClienteId] = useState("");
  const [producto_id, setProductoId] = useState("");
  const [serial, setSerial] = useState("");
  const [tipo_rma, setTipoRma] = useState("garantia");
  const [motivo, setMotivo] = useState("");
  const [prioridad, setPrioridad] = useState("normal");

  const [diagTexto, setDiagTexto] = useState("");
  const [diagResultado, setDiagResultado] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [monto, setMonto] = useState(0);

  const crear = useAction(crearRmaAction, {
    onSuccess: () => {
      toast.success("RMA creado");
      setMostrarForm(false);
      setMotivo("");
      setSerial("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const avanzar = useAction(avanzarRmaAction, {
    onSuccess: () => {
      toast.success("RMA actualizado");
      setExpandido(null);
      setDiagTexto("");
      setDiagResultado("");
      setResolucion("");
      setMonto(0);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const puedeGuardar = Boolean(
    cliente_id && producto_id && motivo.trim().length >= 3 && !crear.isPending,
  );

  const esAbierto = (estado: string) =>
    !["cerrado", "cancelado", "rechazado"].includes(estado);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PackageX className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              RMA
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {rmas.length} autorizaciones de devolución registradas
            </p>
          </div>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {mostrarForm ? (
            "Ocultar formulario"
          ) : (
            <>
              <Plus className="h-4 w-4" /> Nuevo RMA
            </>
          )}
        </button>
      </div>

      {mostrarForm && (
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
                <option value="">Seleccionar...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Producto *
              </label>
              <select
                value={producto_id}
                onChange={(e) => setProductoId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} - ` : ""}
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tipo de RMA *
              </label>
              <select
                value={tipo_rma}
                onChange={(e) => setTipoRma(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                {TIPOS_RMA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Serial
              </label>
              <input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Número de serie"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Prioridad
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                {["baja", "normal", "alta", "urgente"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Motivo *
              </label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo de la autorización"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() =>
                crear.execute({
                  cliente_id,
                  producto_id,
                  serial_producto: serial,
                  tipo_rma: tipo_rma as TipoRma,
                  motivo: motivo.trim(),
                  prioridad: prioridad as Prioridad,
                })
              }
              disabled={!puedeGuardar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Save className="h-4 w-4" />{" "}
              {crear.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {rmas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">N°</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rmas.map((r) => {
                  const est =
                    ESTADO_BADGE[r.estado as string] ??
                    { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", label: r.estado };
                  const abierto = esAbierto(r.estado);
                  const expandidoEste = expandido === r.id;
                  return (
                    <FragmentRma
                      key={r.id}
                      r={r}
                      est={est}
                      abierto={abierto}
                      expandidoEste={expandidoEste}
                      pending={avanzar.isPending}
                      onToggle={() =>
                        setExpandido((prev) => (prev === r.id ? null : r.id))
                      }
                      diagTexto={diagTexto}
                      setDiagTexto={setDiagTexto}
                      diagResultado={diagResultado}
                      setDiagResultado={setDiagResultado}
                      resolucion={resolucion}
                      setResolucion={setResolucion}
                      monto={monto}
                      setMonto={setMonto}
                      onAccion={(input: AccionAvance) =>
                        avanzar.execute({ id: r.id, ...input })
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <PackageX className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">No hay RMA registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FragmentRma({
  r,
  est,
  abierto,
  expandidoEste,
  pending,
  onToggle,
  diagTexto,
  setDiagTexto,
  diagResultado,
  setDiagResultado,
  resolucion,
  setResolucion,
  monto,
  setMonto,
  onAccion,
}: {
  r: RmaDTO;
  est: { cls: string; label: string };
  abierto: boolean;
  expandidoEste: boolean;
  pending: boolean;
  onToggle: () => void;
  diagTexto: string;
  setDiagTexto: (v: string) => void;
  diagResultado: string;
  setDiagResultado: (v: string) => void;
  resolucion: string;
  setResolucion: (v: string) => void;
  monto: number;
  setMonto: (v: number) => void;
  onAccion: (input: AccionAvance) => void;
}) {
  const accion = (input: AccionAvance) => onAccion(input);

  return (
    <>
      <tr className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40">
        <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
          {r.numero_rma}
        </td>
        <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
          {r.cliente_nombre}
        </td>
        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
          {r.producto_nombre}
        </td>
        <td className="px-3 py-2 capitalize text-zinc-600 dark:text-zinc-400">
          {r.tipo_rma.replaceAll("_", " ")}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${est.cls}`}
          >
            {est.label}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-center gap-1">
            {r.estado === "pendiente" && (
              <button
                onClick={() => accion({ accion: "recibir" })}
                disabled={pending}
                className="rounded p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600"
                title="Recibir"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            {r.estado === "recibido" && (
              <button
                onClick={() => accion({ accion: "iniciar_diagnostico" })}
                disabled={pending}
                className="rounded p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600"
                title="Iniciar diagnóstico"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            {r.estado === "en_diagnostico" && (
              <button
                onClick={onToggle}
                className="rounded p-1.5 text-zinc-400 hover:bg-violet-50 hover:text-violet-600"
                title="Diagnosticar"
              >
                <Stethoscope className="h-4 w-4" />
              </button>
            )}
            {r.estado === "diagnosticado" && (
              <button
                onClick={onToggle}
                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                title="Resolver"
              >
                <Wrench className="h-4 w-4" />
              </button>
            )}
            {r.estado === "resuelto" && (
              <button
                onClick={() => accion({ accion: "cerrar" })}
                disabled={pending}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                title="Cerrar"
              >
                <Lock className="h-4 w-4" />
              </button>
            )}
            {abierto && (
              <>
                <button
                  onClick={() => accion({ accion: "rechazar" })}
                  disabled={pending}
                  className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  title="Rechazar"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={onToggle}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  title="Avanzar flujo"
                >
                  {expandidoEste ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {expandidoEste && (
        <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <td colSpan={6} className="px-4 py-4">
            {r.estado === "en_diagnostico" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Diagnóstico técnico
                  </label>
                  <textarea
                    value={diagTexto}
                    onChange={(e) => setDiagTexto(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Resultado
                  </label>
                  <select
                    value={diagResultado}
                    onChange={(e) => setDiagResultado(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {RESULTADOS.map((res) => (
                      <option key={res} value={res}>
                        {res.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end sm:col-span-3">
                  <button
                    onClick={() =>
                      accion({
                        accion: "diagnosticar",
                        diagnostico: diagTexto,
                        resultado_diagnostico: (diagResultado ||
                          undefined) as AvanzarRmaInput["resultado_diagnostico"],
                      })
                    }
                    disabled={!diagResultado || pending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Guardar diagnóstico
                  </button>
                </div>
              </div>
            ) : r.estado === "diagnosticado" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Resolución
                  </label>
                  <select
                    value={resolucion}
                    onChange={(e) => setResolucion(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {RESOLUCIONES.map((res) => (
                      <option key={res} value={res}>
                        {res.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Monto de reembolso (₲)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={monto || ""}
                    onChange={(e) => setMonto(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() =>
                      accion({
                        accion: "resolver",
                        resolucion: (resolucion ||
                          undefined) as AvanzarRmaInput["resolucion"],
                        monto_reembolso: monto,
                      })
                    }
                    disabled={!resolucion || pending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Resolver
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                El RMA está en {r.estado.replaceAll("_", " ")}: usa los botones de
                la fila para avanzar el flujo.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}