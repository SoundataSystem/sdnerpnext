"use client";

import { fechaHora } from "@/lib/formato";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  Save,
  Settings,
  CreditCard,
  Warehouse,
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  actualizarConfiguracionAction,
  crearMetodoPagoAction,
  actualizarMetodoPagoAction,
  eliminarMetodoPagoAction,
} from "@/lib/actions/configuracion-actions";
import {
  crearDepositoAction,
  actualizarDepositoAction,
  eliminarDepositoAction,
} from "@/lib/actions/inventario-actions";
import type { ConfiguracionDTO } from "@/lib/configuracion/repository";
import type { MetodoPagoDTO } from "@/lib/configuracion/repository";
import type { DepositoInventarioDTO } from "@/lib/inventario/repository";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const labelCls =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

type Tab = "general" | "metodos" | "depositos" | "usuarios";

const TABS: Array<{
  id: Tab;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "general", label: "General", icon: <Settings className="h-4 w-4" /> },
  { id: "metodos", label: "Métodos de Pago", icon: <CreditCard className="h-4 w-4" /> },
  { id: "depositos", label: "Depósitos", icon: <Warehouse className="h-4 w-4" /> },
  { id: "usuarios", label: "Usuarios", icon: <Users className="h-4 w-4" /> },
];

export function ConfiguracionClient({
  config,
  metodos,
  depositos,
}: {
  config: ConfiguracionDTO;
  metodos: MetodoPagoDTO[];
  depositos: DepositoInventarioDTO[];
}) {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Configuración
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Parámetros globales, métodos de pago, depósitos y usuarios
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralTab config={config} />}
      {tab === "metodos" && <MetodosPagoTab metodos={metodos} />}
      {tab === "depositos" && <DepositosTab depositos={depositos} />}
      {tab === "usuarios" && <UsuariosTab />}
    </div>
  );
}

// ─── General ────────────────────────────────────────────────────────────────

function GeneralTab({ config }: { config: ConfiguracionDTO }) {
  const [form, setForm] = useState({
    costo_operativo_global: String(config.costo_operativo_global),
    porcentaje_comision_vendedor: String(
      config.porcentaje_comision_vendedor,
    ),
    tipo_cambio_usd: String(config.tipo_cambio_usd),
    texto_base_certificado: config.texto_base_certificado,
    condiciones_generales: config.condiciones_generales,
    membrete_texto: config.membrete_texto,
    logo_url: config.logo_url ?? "",
    email_contacto: config.email_contacto,
    telefono_contacto: config.telefono_contacto,
  });

  const guardar = useAction(actualizarConfiguracionAction, {
    onSuccess: () => toast.success("Configuración guardada"),
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al guardar"),
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    guardar.execute({
      costo_operativo_global: Number(form.costo_operativo_global) || 0,
      porcentaje_comision_vendedor:
        Number(form.porcentaje_comision_vendedor) || 0,
      tipo_cambio_usd: Number(form.tipo_cambio_usd) || 0,
      texto_base_certificado: form.texto_base_certificado,
      condiciones_generales: form.condiciones_generales,
      membrete_texto: form.membrete_texto,
      logo_url: form.logo_url,
      email_contacto: form.email_contacto,
      telefono_contacto: form.telefono_contacto,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Parámetros de cálculo
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Se aplican a órdenes de compra y ventas
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Costo operativo global (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.costo_operativo_global}
              onChange={(e) => set("costo_operativo_global", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Comisión vendedor (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.porcentaje_comision_vendedor}
              onChange={(e) =>
                set("porcentaje_comision_vendedor", e.target.value)
              }
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Tipo de cambio USD (₲)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.tipo_cambio_usd}
              onChange={(e) => set("tipo_cambio_usd", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Personalización
          </h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Membrete</label>
              <input
                value={form.membrete_texto}
                onChange={(e) => set("membrete_texto", e.target.value)}
                placeholder="Razón social, RUC, dirección..."
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Logo (URL)</label>
              <input
                value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Contacto en documentos
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Aparecen en tickets, certificados y cotizaciones
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Correo electrónico</label>
              <input
                type="email"
                value={form.email_contacto}
                onChange={(e) => set("email_contacto", e.target.value)}
                placeholder="contacto@soundata.com.py"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Teléfono</label>
              <input
                value={form.telefono_contacto}
                onChange={(e) => set("telefono_contacto", e.target.value)}
                placeholder="+595 981 000 000"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Certificados de Garantía
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Textos que se imprimen en certificados, cotizaciones y facturas
        </p>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Texto base del certificado</label>
            <textarea
              value={form.texto_base_certificado}
              onChange={(e) => set("texto_base_certificado", e.target.value)}
              rows={4}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Condiciones generales</label>
            <textarea
              value={form.condiciones_generales}
              onChange={(e) => set("condiciones_generales", e.target.value)}
              rows={4}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {config.ultima_modificacion && (
          <p className="text-xs text-zinc-400">
            Última modificación:{" "}
            {fechaHora(config.ultima_modificacion)}
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={guardar.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Save className="h-4 w-4" />{" "}
          {guardar.isPending ? "Guardando..." : "Guardar Configuración"}
        </button>
      </div>
    </div>
  );
}

// ─── Métodos de pago ────────────────────────────────────────────────────────

function MetodosPagoTab({ metodos }: { metodos: MetodoPagoDTO[] }) {
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<MetodoPagoDTO | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(
    null,
  );
  const [nombre, setNombre] = useState("");
  const [porcentajeCosto, setPorcentajeCosto] = useState(0);

  const crear = useAction(crearMetodoPagoAction, {
    onSuccess: () => {
      toast.success("Método de pago creado");
      setModal(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al crear método de pago"),
  });
  const actualizar = useAction(actualizarMetodoPagoAction, {
    onSuccess: () => {
      toast.success("Método de pago actualizado");
      setModal(null);
      setEditando(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar método de pago"),
  });
  const eliminar = useAction(eliminarMetodoPagoAction, {
    onSuccess: () => {
      toast.success("Método de pago eliminado");
      setConfirmarEliminar(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al eliminar método de pago"),
  });

  const abrirCrear = () => {
    setEditando(null);
    setNombre("");
    setPorcentajeCosto(0);
    setModal("crear");
  };
  const abrirEditar = (m: MetodoPagoDTO) => {
    setEditando(m);
    setNombre(m.nombre);
    setPorcentajeCosto(m.porcentaje_costo);
    setModal("editar");
  };
  const guardar = () => {
    if (!nombre.trim()) {
      toast.warning("El nombre es obligatorio");
      return;
    }
    if (modal === "editar" && editando) {
      actualizar.execute({
        id: editando.id,
        data: { nombre: nombre.trim(), porcentaje_costo: porcentajeCosto },
      });
    } else {
      crear.execute({ nombre: nombre.trim(), porcentaje_costo: porcentajeCosto });
    }
  };
  const toggleActivo = (m: MetodoPagoDTO) =>
    actualizar.execute({ id: m.id, data: { activo: !m.activo } });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nuevo Método de Pago
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {metodos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 text-right font-medium">Costo %</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {metodos.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      <CreditCard className="mr-2 inline h-4 w-4 text-zinc-400" />
                      {m.nombre}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {m.porcentaje_costo}%
                    </td>
                    <td className="px-3 py-2">
                      {m.activo ? (
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => abrirEditar(m)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActivo(m)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100"
                          title={m.activo ? "Desactivar" : "Activar"}
                        >
                          {m.activo ? (
                            <X className="h-4 w-4 text-red-500" />
                          ) : (
                            <span className="px-1 text-xs">Activar</span>
                          )}
                        </button>
                        {confirmarEliminar === m.id ? (
                          <>
                            <button
                              onClick={() => eliminar.execute({ id: m.id })}
                              disabled={eliminar.isPending}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmarEliminar(null)}
                              className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmarEliminar(m.id)}
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              Sin métodos de pago registrados
            </p>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {modal === "crear"
                ? "Nuevo Método de Pago"
                : "Editar Método de Pago"}
            </h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Nombre *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Efectivo, Transferencia..."
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Costo (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={porcentajeCosto}
                  onChange={(e) => setPorcentajeCosto(Number(e.target.value))}
                  className={inputCls}
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
                disabled={crear.isPending || actualizar.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Save className="h-4 w-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Depósitos ──────────────────────────────────────────────────────────────

function DepositosTab({ depositos }: { depositos: DepositoInventarioDTO[] }) {
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<DepositoInventarioDTO | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    nombre: "",
    columna_stock: "",
    activo: true,
  });

  const crear = useAction(crearDepositoAction, {
    onSuccess: () => {
      toast.success("Depósito creado");
      setModal(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al crear depósito"),
  });
  const actualizar = useAction(actualizarDepositoAction, {
    onSuccess: () => {
      toast.success("Depósito actualizado");
      setModal(null);
      setEditando(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar depósito"),
  });
  const eliminar = useAction(eliminarDepositoAction, {
    onSuccess: () => {
      toast.success("Depósito eliminado");
      setConfirmarEliminar(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al eliminar depósito"),
  });

  const abrirCrear = () => {
    setEditando(null);
    setForm({ nombre: "", columna_stock: "", activo: true });
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
  const guardar = () => {
    if (!form.nombre.trim() || !form.columna_stock.trim()) {
      toast.warning("Nombre y columna de stock son obligatorios");
      return;
    }
    if (modal === "editar" && editando) {
      actualizar.execute({ id: editando.id, data: form });
    } else {
      crear.execute(form);
    }
  };
  const toggleActivo = (d: DepositoInventarioDTO) =>
    actualizar.execute({ id: d.id, data: { activo: !d.activo } });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Nuevo Depósito
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {depositos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Columna Stock</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {depositos.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      <Warehouse className="mr-2 inline h-4 w-4 text-zinc-400" />
                      {d.nombre}
                    </td>
                    <td className="px-3 py-2">
                      <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {d.columna_stock}
                      </code>
                    </td>
                    <td className="px-3 py-2">
                      {d.activo ? (
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => abrirEditar(d)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActivo(d)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100"
                          title={d.activo ? "Desactivar" : "Activar"}
                        >
                          {d.activo ? (
                            <X className="h-4 w-4 text-red-500" />
                          ) : (
                            <span className="px-1 text-xs">Activar</span>
                          )}
                        </button>
                        {confirmarEliminar === d.id ? (
                          <>
                            <button
                              onClick={() => eliminar.execute({ id: d.id })}
                              disabled={eliminar.isPending}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmarEliminar(null)}
                              className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmarEliminar(d.id)}
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        )}
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
            <p className="font-medium text-zinc-500">Sin depósitos registrados</p>
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
                <label className={labelCls}>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                  placeholder="Ej: Depósito Central"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Columna Stock *</label>
                <input
                  type="text"
                  value={form.columna_stock}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, columna_stock: e.target.value }))
                  }
                  placeholder="stock_deposito_central"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="deposito_activo_cfg"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, activo: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <label
                  htmlFor="deposito_activo_cfg"
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
                disabled={crear.isPending || actualizar.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Save className="h-4 w-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Usuarios ───────────────────────────────────────────────────────────────

function UsuariosTab() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
      <Users className="mx-auto mb-4 h-16 w-16 text-indigo-300" />
      <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
        Gestión de Usuarios
      </h3>
      <p className="mb-6 mt-1 text-sm text-zinc-500">
        Administrá los usuarios del sistema
      </p>
      <Link
        href="/usuarios"
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Users className="h-4 w-4" /> Ir a Usuarios
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}