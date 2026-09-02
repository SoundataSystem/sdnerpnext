"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  Check,
  Link2,
  Pencil,
  Plus,
  Power,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  actualizarUsuarioAction,
  cambiarEstadoUsuarioAction,
  crearUsuarioAction,
  vincularUsuarioAction,
} from "@/lib/actions/usuarios-actions";
import { ROLES } from "@/lib/usuarios/roles";
import type { UsuarioDTO } from "@/lib/usuarios/repository";
import type { RolUsuario } from "@/lib/usuarios/schema";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const labelCls =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const ROL_BADGE: Record<string, string> = {
  admin:
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  vendedor:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  cajero:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  contabilidad:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  compra:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

interface UsuarioForm {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  rol: string;
  telefono: string;
  vendedor_codigo: string;
}

const vacio: UsuarioForm = {
  email: "",
  password: "",
  nombre: "",
  apellido: "",
  rol: "vendedor",
  telefono: "",
  vendedor_codigo: "",
};

export function UsuariosClient({ usuarios }: { usuarios: UsuarioDTO[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [showCrear, setShowCrear] = useState(false);
  const [form, setForm] = useState<UsuarioForm>(vacio);
  const [editando, setEditando] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Record<string, string>>({});
  const [vincular, setVincular] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState("");

  const crear = useAction(crearUsuarioAction, {
    onSuccess: () => {
      toast.success("Usuario creado");
      setShowCrear(false);
      setForm(vacio);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const actualizar = useAction(actualizarUsuarioAction, {
    onSuccess: () => {
      toast.success("Usuario actualizado");
      setEditando(null);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const cambiarEstado = useAction(cambiarEstadoUsuarioAction, {
    onSuccess: () => toast.success("Estado actualizado"),
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });
  const vincularUser = useAction(vincularUsuarioAction, {
    onSuccess: () => {
      toast.success("Usuario vinculado a Supabase");
      setVincular(null);
      setAuthUserId("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error"),
  });

  const filtrados = usuarios.filter((u) => {
    const q = busqueda.toLowerCase();
    return (
      !q ||
      u.nombre.toLowerCase().includes(q) ||
      u.apellido.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.vendedor_codigo ?? "").toLowerCase().includes(q)
    );
  });

  const setNuevo = (k: keyof UsuarioForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleCrear = () => {
    crear.execute({
      email: form.email,
      password: form.password,
      nombre: form.nombre,
      apellido: form.apellido,
      rol: form.rol as RolUsuario,
      telefono: form.telefono,
      vendedor_codigo: form.vendedor_codigo,
    });
  };

  const abrirEdicion = (u: UsuarioDTO) => {
    setEditando(u.id);
    setEdicion({
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      telefono: u.telefono ?? "",
      vendedor_codigo: u.vendedor_codigo ?? "",
      password: "",
    });
  };

  const setEdit = (k: string, v: string) =>
    setEdicion((prev) => ({ ...prev, [k]: v }));

  const guardarEdicion = (id: string) => {
    const d = edicion;
    actualizar.execute({
      id,
      data: {
        email: d.email,
        nombre: d.nombre,
        apellido: d.apellido,
        rol: d.rol as RolUsuario,
        telefono: d.telefono,
        vendedor_codigo: d.vendedor_codigo,
        ...(d.password ? { password: d.password } : {}),
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Usuarios
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Cuentas del sistema, roles y acceso a Supabase Auth
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCrear((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {showCrear ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCrear ? "Cancelar" : "Nuevo usuario"}
        </button>
      </div>

      {showCrear && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Nuevo usuario
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Crea la cuenta de login en Supabase y su perfil en el sistema.{" "}
            {crear.result?.data ? "" : ""}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setNuevo("email", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Contraseña *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setNuevo("password", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Rol *</label>
              <select
                value={form.rol}
                onChange={(e) => setNuevo("rol", e.target.value)}
                className={inputCls}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => setNuevo("nombre", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Apellido *</label>
              <input
                value={form.apellido}
                onChange={(e) => setNuevo("apellido", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Código de vendedor</label>
              <input
                value={form.vendedor_codigo}
                onChange={(e) => setNuevo("vendedor_codigo", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => setNuevo("telefono", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCrear}
              disabled={crear.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" />{" "}
              {crear.isPending ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center gap-3">
          <p className="text-sm font-medium text-zinc-500">
            {usuarios.length} usuario(s)
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
                  <th className="px-3 py-2 font-medium">Usuario</th>
                  <th className="px-3 py-2 font-medium">Rol</th>
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 text-right font-medium">Órdenes</th>
                  <th className="px-3 py-2 font-medium">Auth</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <UsuarioRow
                    key={u.id}
                    u={u}
                    editando={editando === u.id}
                    edicion={edicion}
                    onEditar={() =>
                      editando === u.id ? setEditando(null) : abrirEdicion(u)
                    }
                    onSetEdit={setEdit}
                    onGuardar={() => guardarEdicion(u.id)}
                    actualizando={actualizar.isPending}
                    onToggleActivo={() =>
                      cambiarEstado.execute({
                        id: u.id,
                        activo: u.activo !== false,
                      })
                    }
                    onVincular={() => setVincular(u.id)}
                    vincularAbierto={vincular === u.id}
                    authUserId={authUserId}
                    onAuthUserId={setAuthUserId}
                    onConfirmarVincular={() =>
                      vincularUser.execute({
                        usuario_id: u.id,
                        auth_user_id: authUserId,
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              No hay usuarios registrados
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function UsuarioRow({
  u,
  editando,
  edicion,
  onEditar,
  onSetEdit,
  onGuardar,
  actualizando,
  onToggleActivo,
  onVincular,
  vincularAbierto,
  authUserId,
  onAuthUserId,
  onConfirmarVincular,
}: {
  u: UsuarioDTO;
  editando: boolean;
  edicion: Record<string, string>;
  onEditar: () => void;
  onSetEdit: (k: string, v: string) => void;
  onGuardar: () => void;
  actualizando: boolean;
  onToggleActivo: () => void;
  onVincular: () => void;
  vincularAbierto: boolean;
  authUserId: string;
  onAuthUserId: (v: string) => void;
  onConfirmarVincular: () => void;
}) {
  const rolBadge = ROL_BADGE[u.rol] ?? ROL_BADGE.vendedor!;
  const activo = u.activo !== false;

  return (
    <>
      <tr className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40">
        <td className="px-3 py-2">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {u.nombre} {u.apellido}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${rolBadge}`}
          >
            {u.rol.replaceAll("_", " ")}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {u.vendedor_codigo ?? "—"}
        </td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">
          {u.ordenes_count}
        </td>
        <td className="px-3 py-2">
          {u.auth_user_id ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Link2 className="h-3.5 w-3.5" /> Vinculado
            </span>
          ) : (
            <span className="text-xs text-zinc-400">Sin vincular</span>
          )}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
              activo
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {activo ? "activo" : "inactivo"}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={onEditar}
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleActivo}
              className={`rounded p-1.5 hover:bg-zinc-100 ${
                activo
                  ? "text-zinc-400 hover:text-red-600"
                  : "text-zinc-400 hover:text-emerald-600"
              }`}
              title={activo ? "Desactivar" : "Activar"}
            >
              <Power className="h-4 w-4" />
            </button>
            <button
              onClick={onVincular}
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-violet-600"
              title="Vincular a Supabase"
            >
              <Link2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {editando && (
        <tr className="border-b border-zinc-100 bg-zinc-50/60 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <td colSpan={7} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1">
                <label className={labelCls}>Email</label>
                <input
                  value={edicion.email ?? ""}
                  onChange={(e) => onSetEdit("email", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Nombre</label>
                <input
                  value={edicion.nombre ?? ""}
                  onChange={(e) => onSetEdit("nombre", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Apellido</label>
                <input
                  value={edicion.apellido ?? ""}
                  onChange={(e) => onSetEdit("apellido", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Rol</label>
                <select
                  value={edicion.rol ?? u.rol}
                  onChange={(e) => onSetEdit("rol", e.target.value)}
                  className={inputCls}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Código vendedor</label>
                <input
                  value={edicion.vendedor_codigo ?? ""}
                  onChange={(e) =>
                    onSetEdit("vendedor_codigo", e.target.value)
                  }
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Nueva contraseña</label>
                <input
                  type="password"
                  value={edicion.password ?? ""}
                  onChange={(e) => onSetEdit("password", e.target.value)}
                  placeholder="Opcional"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={onGuardar}
                disabled={actualizando}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Check className="h-4 w-4" /> Guardar
              </button>
              <button
                onClick={onEditar}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
      {vincularAbierto && (
        <tr className="border-b border-zinc-100 bg-zinc-50/60 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <td colSpan={7} className="px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <label className={labelCls}>
                  ID de usuario de Supabase (auth.users)
                </label>
                <input
                  value={authUserId}
                  onChange={(e) => onAuthUserId(e.target.value)}
                  placeholder="UUID del usuario en Supabase"
                  className={inputCls}
                />
              </div>
              <button
                onClick={onConfirmarVincular}
                disabled={!authUserId.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Link2 className="h-4 w-4" /> Vincular
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
