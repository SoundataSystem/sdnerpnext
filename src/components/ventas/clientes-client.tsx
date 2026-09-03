"use client";

import { numero } from "@/lib/formato";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Users, Search, Plus, Pencil, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import {
  crearClienteAction,
  actualizarClienteAction,
} from "@/lib/actions/ventas-actions";
import type { ClienteDTO } from "@/lib/ventas/repository";

const emptyForm = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "",
  ruc: "",
  pais: "Paraguay",
  tipo_documento: "CI",
};

export function ClientesClient({
  items,
  total,
  page,
  pageSize,
  busqueda: busquedaInicial,
}: {
  items: ClienteDTO[];
  total: number;
  page: number;
  pageSize: number;
  busqueda: string;
}) {
  const router = useRouter();
  const [busquedaInput, setBusquedaInput] = useState(busquedaInicial);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<ClienteDTO | null>(null);
  const [form, setForm] = useState(emptyForm);

  const crear = useAction(crearClienteAction, {
    onSuccess: () => {
      toast.success("Cliente creado");
      setModal(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al crear cliente"),
  });

  const editar = useAction(actualizarClienteAction, {
    onSuccess: () => {
      toast.success("Cliente actualizado");
      setModal(null);
      setEditando(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar cliente"),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buscar = (termino: string) => {
    const q = termino.trim();
    router.push(`/ventas/clientes?busqueda=${encodeURIComponent(q)}&page=1&pageSize=${pageSize}`);
  };

  const irPagina = (p: number) => {
    if (p < 1 || p > totalPages) return;
    router.push(
      `/ventas/clientes?busqueda=${encodeURIComponent(busquedaInicial)}&page=${p}&pageSize=${pageSize}`,
    );
  };

  const cambiarPageSize = (n: number) => {
    router.push(`/ventas/clientes?busqueda=${encodeURIComponent(busquedaInicial)}&page=1&pageSize=${n}`);
  };

  const abrirCrear = () => {
    setForm(emptyForm);
    setEditando(null);
    setModal("crear");
  };

  const abrirEditar = (c: ClienteDTO) => {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      apellido: c.apellido,
      cedula: c.cedula,
      telefono: c.telefono,
      email: c.email,
      direccion: c.direccion ?? "",
      ciudad: c.ciudad ?? "",
      ruc: c.ruc ?? "",
      pais: c.pais ?? "Paraguay",
      tipo_documento: c.tipo_documento,
    });
    setModal("editar");
  };

  const setCampo = (campo: keyof typeof emptyForm, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = () => {
    if (
      !form.nombre.trim() ||
      !form.apellido.trim() ||
      !form.cedula.trim() ||
      !form.telefono.trim()
    ) {
      toast.warning("Nombre, apellido, cédula y teléfono son obligatorios");
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
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Clientes
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Registro de clientes para las ventas
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const q = busquedaInicial ? `?busqueda=${encodeURIComponent(busquedaInicial)}` : "";
              const res = await fetch(`/api/ventas/clientes/export${q}`);
              if (!res.ok) { toast.error("Error al exportar"); return; }
              const { items } = (await res.json()) as { items: Record<string, unknown>[] };
              if (!items.length) { toast.warning("Sin datos para exportar"); return; }
              const XLSX = await import("xlsx");
              const cols = [
                { key: "nombre", header: "Nombre" },
                { key: "apellido", header: "Apellido" },
                { key: "tipo_documento", header: "Tipo Doc." },
                { key: "cedula", header: "Cédula/RUC" },
                { key: "ruc", header: "RUC" },
                { key: "telefono", header: "Teléfono" },
                { key: "email", header: "Email" },
                { key: "direccion", header: "Dirección" },
                { key: "ciudad", header: "Ciudad" },
                { key: "pais", header: "País" },
              ];
              const rows = items.map((r) => {
                const o: Record<string, string> = {};
                cols.forEach((c) => { o[c.header] = String((r[c.key] as string) ?? ""); });
                return o;
              });
              const ws = XLSX.utils.json_to_sheet(rows);
              cols.forEach((_, i) => { const col = ws[XLSX.utils.encode_col(i)]; if (col) ws["!cols"] = ws["!cols"] || []; });
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Clientes");
              XLSX.writeFile(wb, `clientes${busquedaInicial ? `-${busquedaInicial}` : ""}.xlsx`);
              toast.success(`${items.length} clientes exportados`);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
          >
            <FileDown className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={abrirCrear}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" /> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-zinc-500">
            {busquedaInicial ? (
              <>
                {numero(total)} resultado{total !== 1 ? "s" : ""} para{" "}
                <span className="font-semibold">&ldquo;{busquedaInicial}&rdquo;</span>
              </>
            ) : (
              <>Escriba en el buscador para encontrar clientes (43.485 registrados)</>
            )}
          </p>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {busquedaInicial && (
              <select
                value={pageSize}
                onChange={(e) => cambiarPageSize(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                title="Filas por página"
              >
                <option value={20}>20 / pág</option>
                <option value={50}>50 / pág</option>
                <option value={100}>100 / pág</option>
              </select>
            )}
            <div className="relative flex w-full sm:w-72">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, cédula, teléfono... (mín. 2 caracteres)"
                  value={busquedaInput}
                  onChange={(e) => setBusquedaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") buscar(busquedaInput);
                  }}
                  className="w-full rounded-l-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>
              <button
                onClick={() => buscar(busquedaInput)}
                disabled={!busquedaInput.trim() || busquedaInput.trim().length < 2}
                className="rounded-r-lg border border-l-0 border-zinc-300 bg-zinc-100 px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Cédula</th>
                  <th className="px-3 py-2 font-medium">Teléfono</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Ciudad</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {c.nombre} {c.apellido}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {c.cedula}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {c.telefono}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {c.email}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {c.ciudad ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => abrirEditar(c)}
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
        ) : !busquedaInicial ? (
          <div className="py-12 text-center text-zinc-400">Escriba en el buscador para encontrar clientes</div>
        ) : (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">{`Sin resultados para "${busquedaInicial}"`}</p>
            <p className="mt-1 text-sm text-zinc-400">Pruebe con nombre, apellido, cédula o teléfono (mín. 2 caracteres)</p>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Página {page} de {totalPages}
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
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {modal === "crear" ? "Nuevo Cliente" : "Editar Cliente"}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { campo: "nombre" as const, label: "Nombre *", type: "text" },
                { campo: "apellido" as const, label: "Apellido *", type: "text" },
                { campo: "cedula" as const, label: "Cédula *", type: "text" },
                { campo: "telefono" as const, label: "Teléfono *", type: "text" },
                { campo: "email" as const, label: "Email", type: "email" },
                { campo: "ruc" as const, label: "RUC", type: "text" },
                { campo: "ciudad" as const, label: "Ciudad", type: "text" },
                { campo: "pais" as const, label: "País", type: "text" },
                { campo: "tipo_documento" as const, label: "Tipo documento", type: "text" },
              ].map((f) => (
                <div key={f.campo} className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={form[f.campo]}
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
                  value={form.direccion}
                  onChange={(e) => setCampo("direccion", e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
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