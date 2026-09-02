"use client";

import { numero } from "@/lib/formato";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { crearAsientoAction } from "@/lib/actions/contabilidad-actions";
import type { CuentaDTO } from "@/lib/contabilidad/repository";

interface LineaDetalle {
  cuenta_id: string;
  debe: number;
  haber: number;
}

const emptyLinea = (): LineaDetalle => ({
  cuenta_id: "",
  debe: 0,
  haber: 0,
});

const MIN_LINEAS = 2;

export function AsientoFormClient({ cuentas }: { cuentas: CuentaDTO[] }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(() =>
    new Date().toISOString().split("T")[0],
  );
  const [concepto, setConcepto] = useState("");
  const [lineas, setLineas] = useState<LineaDetalle[]>([
    emptyLinea(),
    emptyLinea(),
  ]);

  const crear = useAction(crearAsientoAction, {
    onSuccess: () => {
      toast.success("Asiento creado");
      router.push("/contabilidad/asientos");
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al guardar asiento"),
  });

  // Cuentas asignables: nivel 3 (imputables) y activas
  const cuentasActivas = useMemo(
    () => cuentas.filter((c) => c.activo && c.nivel === 3),
    [cuentas],
  );

  const totalDebe = useMemo(
    () => lineas.reduce((s, l) => s + (l.debe || 0), 0),
    [lineas],
  );
  const totalHaber = useMemo(
    () => lineas.reduce((s, l) => s + (l.haber || 0), 0),
    [lineas],
  );
  const diferencia = totalDebe - totalHaber;
  const cuadrado = diferencia === 0;
  const tieneDetalles = totalDebe > 0 && totalHaber > 0;

  const puedeGuardar = Boolean(
    concepto.trim() &&
      lineas.every((l) => l.cuenta_id) &&
      cuadrado &&
      tieneDetalles &&
      !crear.isPending,
  );

  const agregarLinea = () => setLineas((p) => [...p, emptyLinea()]);

  const eliminarLinea = (idx: number) => {
    setLineas((p) => (p.length > MIN_LINEAS ? p.filter((_, i) => i !== idx) : p));
  };

  const actualizarLinea = (idx: number, cambios: Partial<LineaDetalle>) => {
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)),
    );
  };

  const actualizarDebe = (idx: number, debe: number) => {
    setLineas((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, debe, haber: debe > 0 ? 0 : l.haber } : l,
      ),
    );
  };

  const actualizarHaber = (idx: number, haber: number) => {
    setLineas((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, haber, debe: haber > 0 ? 0 : l.debe } : l,
      ),
    );
  };

  const handleSubmit = async () => {
    if (!concepto.trim()) {
      toast.warning("Ingresa un concepto");
      return;
    }
    if (lineas.some((l) => !l.cuenta_id)) {
      toast.warning("Todas las líneas deben tener una cuenta");
      return;
    }
    if (!cuadrado) {
      toast.warning(
        `El asiento no cuadra: diferencia de ₲ ${numero(Math.abs(diferencia))}`,
      );
      return;
    }

    // Número atómico lo resuelve el servidor (crearAsiento lo genera en la tx)
    crear.execute({
      asiento: { numero_asiento: "", fecha, concepto, estado: "borrador" },
      detalles: lineas.map((l) => ({
        cuenta_id: l.cuenta_id,
        debe: l.debe || 0,
        haber: l.haber || 0,
      })),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/contabilidad/asientos")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Nuevo Asiento
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Registrar asiento contable (partida doble)
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!puedeGuardar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Save className="h-4 w-4" /> {crear.isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Concepto *
            </label>
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Descripción del asiento"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Líneas del asiento
          </h2>
          <button
            onClick={agregarLinea}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" /> Agregar línea
          </button>
        </div>

        <div className="space-y-2">
          {lineas.map((l, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={l.cuenta_id}
                onChange={(e) =>
                  actualizarLinea(i, { cuenta_id: e.target.value })
                }
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentasActivas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500">Debe</label>
                <input
                  type="number"
                  min={0}
                  value={l.debe || ""}
                  onChange={(e) => actualizarDebe(i, Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                />
                <label className="text-xs text-zinc-500">Haber</label>
                <input
                  type="number"
                  min={0}
                  value={l.haber || ""}
                  onChange={(e) => actualizarHaber(i, Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                />
                <button
                  onClick={() => eliminarLinea(i)}
                  disabled={lineas.length <= MIN_LINEAS}
                  className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  title="Eliminar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-zinc-500">Total Debe: </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                ₲ {numero(totalDebe)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Total Haber: </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                ₲ {numero(totalHaber)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Diferencia: </span>
              <span
                className={`font-semibold ${
                  cuadrado ? "text-emerald-600" : "text-red-600"
                }`}
              >
                ₲ {numero(Math.abs(diferencia))}
              </span>
            </div>
          </div>
          {cuadrado && tieneDetalles ? (
            <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Partida doble cuadrada
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              El asiento no cuadra
            </span>
          )}
        </div>
      </div>
    </div>
  );
}