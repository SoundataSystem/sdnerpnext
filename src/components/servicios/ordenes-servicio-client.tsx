"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  Wrench,
  Plus,
  Save,
  Play,
  CheckCircle,
  XCircle,
  UserCog,
} from "lucide-react";
import {
  crearOrdenServicioAction,
  cambiarEstadoOrdenServicioAction,
  asignarTecnicoAction,
} from "@/lib/actions/servicios-actions";
import { calcularCostoTotal, formatGs } from "@/lib/servicios/calculos";
import type { OrdenServicioDTO } from "@/lib/servicios/repository";
import type { TecnicoDTO } from "@/lib/servicios/repository";
import type { Prioridad, TipoServicio } from "@/lib/servicios/schema";
import type { ClienteDTO, ProductoVentaDTO } from "@/lib/ventas/repository";

const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  pendiente: {
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "pendiente",
  },
  en_progreso: {
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "en progreso",
  },
  completado: {
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "completado",
  },
  cancelado: {
    cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "cancelado",
  },
  facturado: {
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "facturado",
  },
};

const TIPOS = [
  { value: "instalacion", label: "Instalación" },
  { value: "reparacion", label: "Reparación" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "garantia", label: "Garantía" },
  { value: "otro", label: "Otro" },
];

export function OrdenesServicioClient({
  ordenes,
  clientes,
  productos,
  tecnicos,
}: {
  ordenes: OrdenServicioDTO[];
  clientes: ClienteDTO[];
  productos: ProductoVentaDTO[];
  tecnicos: TecnicoDTO[];
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cliente_id, setClienteId] = useState("");
  const [producto_id, setProductoId] = useState("");
  const [tipo_servicio, setTipoServicio] = useState("reparacion");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("normal");
  const [fecha_prometida, setFechaPrometida] = useState("");
  const [costo_servicio, setCostoServicio] = useState(0);
  const [costo_repuestos, setCostoRepuestos] = useState(0);
  const [tecnico_asignado, setTecnicoAsignado] = useState("");

  const crear = useAction(crearOrdenServicioAction, {
    onSuccess: () => {
      toast.success("Orden de servicio creada");
      setMostrarForm(false);
      setDescripcion("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const cambiarEstado = useAction(cambiarEstadoOrdenServicioAction, {
    onSuccess: () => toast.success("Estado actualizado"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const asignarTec = useAction(asignarTecnicoAction, {
    onSuccess: () => toast.success("Técnico asignado"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const costoTotal = calcularCostoTotal(costo_servicio, costo_repuestos);
  const puedeGuardar = Boolean(
    cliente_id &&
      descripcion.trim().length >= 3 &&
      !crear.isPending,
  );

  const handleCrear = () => {
    crear.execute({
      cliente_id,
      producto_id: producto_id || "",
      tipo_servicio: tipo_servicio as TipoServicio,
      descripcion: descripcion.trim(),
      prioridad: prioridad as Prioridad,
      fecha_prometida: fecha_prometida || "",
      costo_servicio,
      costo_repuestos,
      tecnico_asignado: tecnico_asignado || "",
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Órdenes de Servicio
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {ordenes.length} órdenes registradas
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
              <Plus className="h-4 w-4" /> Nueva Orden
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
                    {c.nombre} {c.apellido} · {c.cedula}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Producto
              </label>
              <select
                value={producto_id}
                onChange={(e) => setProductoId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Sin producto...</option>
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
                Tipo de servicio *
              </label>
              <select
                value={tipo_servicio}
                onChange={(e) => setTipoServicio(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Descripción *
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe el trabajo a realizar"
                rows={2}
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
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Fecha prometida
              </label>
              <input
                type="date"
                value={fecha_prometida}
                onChange={(e) => setFechaPrometida(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Técnico asignado
              </label>
              <select
                value={tecnico_asignado}
                onChange={(e) => setTecnicoAsignado(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Sin asignar...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Costo mano de obra (₲)
              </label>
              <input
                type="number"
                min={0}
                value={costo_servicio || ""}
                onChange={(e) => setCostoServicio(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Costo repuestos (₲)
              </label>
              <input
                type="number"
                min={0}
                value={costo_repuestos || ""}
                onChange={(e) => setCostoRepuestos(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm">
                <span className="text-zinc-500">Total: </span>
                <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatGs(costoTotal)}
                </span>
              </p>
              <button
                onClick={handleCrear}
                disabled={!puedeGuardar}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Save className="h-4 w-4" />{" "}
                {crear.isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {ordenes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">N°</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Técnico</th>
                  <th className="px-3 py-2 text-right font-medium">Costo</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => {
                  const est =
                    ESTADO_BADGE[o.estado as string] ??
                    { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", label: o.estado };
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
                        {o.numero_orden}
                      </td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {o.cliente_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {o.producto_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 capitalize text-zinc-600 dark:text-zinc-400">
                        {o.tipo_servicio}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          {o.tecnico_nombre ?? "—"}
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value)
                                asignarTec.execute({ id: o.id, tecnico_id: e.target.value });
                            }}
                            className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px]"
                            title="Asignar técnico"
                          >
                            <option value="">Cambiar</option>
                            {tecnicos.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {formatGs(o.costo_total)}
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
                          {o.estado === "pendiente" && (
                            <button
                              onClick={() =>
                                cambiarEstado.execute({ id: o.id, estado: "en_progreso" })
                              }
                              disabled={cambiarEstado.isPending}
                              className="rounded p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Iniciar"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {(o.estado === "pendiente" || o.estado === "en_progreso") && (
                            <>
                              <button
                                onClick={() =>
                                  cambiarEstado.execute({ id: o.id, estado: "completado" })
                                }
                                disabled={cambiarEstado.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Completar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  cambiarEstado.execute({ id: o.id, estado: "cancelado" })
                                }
                                disabled={cambiarEstado.isPending}
                                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Cancelar"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {o.estado === "completado" && (
                            <button
                              onClick={() =>
                                cambiarEstado.execute({ id: o.id, estado: "facturado" })
                              }
                              disabled={cambiarEstado.isPending}
                              className="rounded p-1.5 text-zinc-400 hover:bg-violet-50 hover:text-violet-600"
                              title="Marcar facturado"
                            >
                              <UserCog className="h-4 w-4" />
                            </button>
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
            <Wrench className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay órdenes de servicio registradas
            </p>
            <button
              onClick={() => setMostrarForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" /> Nueva Orden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}