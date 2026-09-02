"use client";

import { useMemo, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  ChevronDown,
  FileUp,
  Import,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  finalizarImportacionPegasusAction,
  procesarLotePegasusAction,
  revertirImportacionAction,
} from "@/lib/actions/pegasus-actions";
import { CAMPOS_TIPO, NOMBRES_TIPO, CLAVES_TIPO, detectarTipoPegasus } from "@/lib/pegasus/constantes";
import { detectarCabecera } from "@/lib/pegasus/parser";
import type { TipoImportacionPegasus } from "@/generated/prisma/client";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export interface ImportacionItem {
  id: string;
  tipo: TipoImportacionPegasus;
  archivo_nombre: string;
  filas_total: number | null;
  filas_ok: number | null;
  filas_warning: number | null;
  filas_error: number | null;
  estado: string;
  log_detalle: unknown;
  created_at: string;
  usuario: { nombre: string; apellido: string; email: string } | null;
}

const TIPOS = Object.entries(NOMBRES_TIPO) as [TipoImportacionPegasus, string][];

/**
 * Formatea una fecha ISO usando zona horaria fija de Paraguay (America/Asuncion).
 * Al fijar explicitamente timeZone se evita el mismatch de hidratacion entre
 * el SSR (UTC en Vercel) y el navegador del usuario (America/Asuncion), que era
 * la causa del error React #418 al usar toLocaleString("es-PY") sin timeZone.
 */
function formatearFechaImportacion(fecha: string): string {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Asuncion",
  }).format(new Date(fecha));
}

const ESTADO_BADGE: Record<string, string> = {
  completada:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  parcial:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  revertida:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export function PegasusClient({
  importaciones,
}: {
  importaciones: ImportacionItem[];
}) {
  const [tipo, setTipo] = useState<TipoImportacionPegasus>("clientes");
  const [contenido, setContenido] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [confirmarRevertir, setConfirmarRevertir] = useState<string | null>(
    null,
  );
  const [progreso, setProgreso] = useState<{
    activo: boolean;
    actual: number;
    total: number;
  }>({ activo: false, actual: 0, total: 0 });
  const [resultadoFinal, setResultadoFinal] = useState<{
    estado: string;
    filas_total: number;
    filas_ok: number;
    filas_warning: number;
    filas_error: number;
  } | null>(null);

  const proceso = useAction(procesarLotePegasusAction, {
    onError: (err) => toast.error(err.error.serverError ?? "Error en el lote"),
  });
  const finalizar = useAction(finalizarImportacionPegasusAction, {
    onSuccess: () => {},
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al finalizar importación"),
  });
  const revertir = useAction(revertirImportacionAction, {
    onSuccess: () => {
      toast.success("Importación revertida");
      setConfirmarRevertir(null);
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al revertir"),
  });

  const campos = useMemo(() => CAMPOS_TIPO[tipo], [tipo]);

  /** Envía el archivo por lotes chicos para no pasarse del body/timeout del serverless. */
  const importarPorLotes = async () => {
    if (!contenido.trim() || progreso.activo) return;
    const lineas = contenido
      .split(/\r?\n/)
      .map((l) => l.trimStart().trimEnd())
      .filter((l) => l.length > 0);
    // La exportación de Pegasus suele traer filas de título/fecha antes de los
    // encabezados reales. Detectamos la fila de encabezados por coincidencia con
    // las claves esperadas para el tipo elegido.
    const celdasLineas = lineas.map((l) => l.split(";").map((c) => c.trim()));
    const idxCab = detectarCabecera(celdasLineas, new Set(CLAVES_TIPO[tipo]));
    const cabecera = lineas[idxCab >= 0 ? idxCab : 0] ?? "";
    const cuerpo = idxCab >= 0 ? lineas.slice(idxCab + 1) : lineas.slice(1);
    if (cuerpo.length === 0) {
      toast.error("No hay filas para importar");
      return;
    }
    const TAM = 300;
    const importacionId = crypto.randomUUID();
    const totalLotes = Math.ceil(cuerpo.length / TAM);
    const acumulado = {
      filas_ok: 0,
      filas_warning: 0,
      filas_error: 0,
    };
    setResultadoFinal(null);
    setProgreso({ activo: true, actual: 0, total: totalLotes });
    try {
      for (let i = 0; i < totalLotes; i++) {
        const chunk = cuerpo.slice(i * TAM, (i + 1) * TAM).join("\n");
        const res = await proceso.executeAsync({
          importacionId,
          tipo,
          cabecera,
          cuerpo: chunk,
          filaInicio: i * TAM,
        });
        if (res?.serverError) throw new Error(res.serverError);
        if (res?.data) {
          acumulado.filas_ok += res.data.filas_ok;
          acumulado.filas_warning += res.data.filas_warning;
          acumulado.filas_error += res.data.filas_error;
        }
        setProgreso({ activo: true, actual: i + 1, total: totalLotes });
      }
      const fin = await finalizar.executeAsync({
        importacionId,
        archivo_nombre: archivoNombre,
      });
      if (fin?.serverError) throw new Error(fin.serverError);
      if (fin?.data) {
        setResultadoFinal({
          estado: fin.data.estado,
          filas_total: cuerpo.length,
          filas_ok: acumulado.filas_ok,
          filas_warning: acumulado.filas_warning,
          filas_error: acumulado.filas_error,
        });
      }
      setContenido("");
      setArchivoNombre("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setProgreso({ activo: false, actual: 0, total: 0 });
    }
  };

  const leerArchivo = (file: File | null) => {
    if (!file) return;
    setArchivoNombre(file.name);
    const aplicarContenido = (texto: string) => {
      setContenido(texto);
      // Auto-detección del tipo según las cabeceras reales del export (misma
      // lógica que PROD QA): detecta la fila de cabecera y el tipo por columnas.
      const lineas = texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const celdas = lineas.map((l) => l.split(";").map((c) => c.trim()));
      const claves = new Set(Object.values(CLAVES_TIPO).flat());
      const idxCab = detectarCabecera(celdas, claves);
      if (idxCab >= 0) {
        const detectado = detectarTipoPegasus(celdas[idxCab]);
        if (detectado) setTipo(detectado as TipoImportacionPegasus);
      }
    };
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const datos = new Uint8Array(reader.result as ArrayBuffer);
          const libro = XLSX.read(datos, { type: "array" });
          const hoja = libro.Sheets[libro.SheetNames[0]];
          if (!hoja) {
            toast.error("El archivo Excel no contiene hojas");
            setContenido("");
            return;
          }
          aplicarContenido(
            XLSX.utils.sheet_to_csv(hoja, { FS: ";", blankrows: false }),
          );
        } catch {
          toast.error("No se pudo leer el archivo Excel");
          setContenido("");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let texto = String(reader.result ?? "");
      if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
      aplicarContenido(texto);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Import className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Importación Pegasus
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Migra datos desde la exportación CSV de Pegasus al sistema
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Nueva importación
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelCls}>Tipo de datos *</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoImportacionPegasus)}
              className={inputCls}
            >
              {TIPOS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Archivo CSV / Excel</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700">
              <Upload className="h-4 w-4" />
              {archivoNombre || "Elegir archivo .csv / .xlsx"}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,text/plain"
                className="hidden"
                onChange={(e) => leerArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <label className={labelCls}>
            Contenido CSV * <span className="text-zinc-400">(separa con ;)</span>
          </label>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={8}
            placeholder={`Primera fila = encabezados. Ejemplo:\n${campos}\ndato1;dato2;...`}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Columnas esperadas: <span className="font-mono">{campos}</span>
          </p>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {progreso.activo && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Procesando lote {progreso.actual} de {progreso.total}...
            </p>
          )}
          <button
            onClick={() => {
              void importarPorLotes();
            }}
            disabled={progreso.activo || !contenido.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <FileUp className="h-4 w-4" />
            {progreso.activo ? "Importando..." : "Importar"}
          </button>
        </div>

        {resultadoFinal && (
          <div
            className={`mt-4 rounded-xl border p-4 text-sm ${
              resultadoFinal.estado === "completada"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            }`}
          >
            <p className="font-medium">
              Resultado ({resultadoFinal.estado})
            </p>
            <p className="mt-1 text-xs">
              {resultadoFinal.filas_total} filas · {resultadoFinal.filas_ok} ok
              · {resultadoFinal.filas_warning} avisos ·{" "}
              {resultadoFinal.filas_error} errores
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="px-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Historial
        </h2>
        {importaciones.length === 0 ? (
          <div className="py-12 text-center">
            <Import className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-500">
              Aún no hay importaciones registradas
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Archivo</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                  <th className="px-3 py-2 text-right font-medium">Filas</th>
                  <th className="px-3 py-2 text-right font-medium">OK</th>
                  <th className="px-3 py-2 text-right font-medium">Err</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {importaciones.map((imp) => {
                  const detalle = (imp.log_detalle ?? {}) as {
                    log?: string[];
                  };
                  const log = detalle.log ?? [];
                  const expandido = expandidos[imp.id];
                  const revertible = ["completada", "parcial"].includes(
                    imp.estado,
                  );
                  return (
                    <FilaImportacion
                      key={imp.id}
                      imp={imp}
                      expandido={expandido}
                      log={log}
                      onToggle={() =>
                        setExpandidos((prev) => ({
                          ...prev,
                          [imp.id]: !expandido,
                        }))
                      }
                      revertible={revertible}
                      confirmando={confirmarRevertir === imp.id}
                      onConfirmar={() => setConfirmarRevertir(imp.id)}
                      onCancelarRevertir={() => setConfirmarRevertir(null)}
                      onRevertir={() => {
                        revertir.executeAsync({ id: imp.id }).catch(() => {});
                      }}
                      revirtiendo={revertir.isPending}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilaImportacion({
  imp,
  expandido,
  log,
  onToggle,
  revertible,
  confirmando,
  onConfirmar,
  onCancelarRevertir,
  onRevertir,
  revirtiendo,
}: {
  imp: ImportacionItem;
  expandido: boolean;
  log: string[];
  onToggle: () => void;
  revertible: boolean;
  confirmando: boolean;
  onConfirmar: () => void;
  onCancelarRevertir: () => void;
  onRevertir: () => void;
  revirtiendo: boolean;
}) {
  const badge =
    ESTADO_BADGE[imp.estado] ??
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <>
      <tr className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40">
        <td className="px-3 py-2 whitespace-nowrap text-xs text-zinc-500">
          {formatearFechaImportacion(imp.created_at)}
        </td>
        <td className="px-3 py-2 capitalize">{imp.tipo}</td>
        <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
          {imp.archivo_nombre}
        </td>
        <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
          {imp.usuario
            ? `${imp.usuario.nombre} ${imp.usuario.apellido}`
            : "—"}
        </td>
        <td className="px-3 py-2 text-right text-zinc-600">{imp.filas_total}</td>
        <td className="px-3 py-2 text-right text-emerald-600">{imp.filas_ok}</td>
        <td className="px-3 py-2 text-right text-red-600">{imp.filas_error}</td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${badge}`}
          >
            {imp.estado}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-center gap-1">
            {log.length > 0 && (
              <button
                onClick={onToggle}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
                title="Ver detalle"
              >
                <ChevronDown
                  className={`h-4 w-4 transition ${expandido ? "rotate-180" : ""}`}
                />
              </button>
            )}
            {revertible &&
              (confirmando ? (
                <>
                  <button
                    onClick={onRevertir}
                    disabled={revirtiendo}
                    className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={onCancelarRevertir}
                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    No
                  </button>
                </>
              ) : (
                <button
                  onClick={onConfirmar}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                  title="Revertir (elimina registros creados)"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ))}
          </div>
        </td>
      </tr>
      {expandido && (
        <tr className="border-b border-zinc-100 bg-zinc-50/60 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <td colSpan={9} className="px-3 py-3">
            <div className="max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950">
              {log.map((l, i) => (
                <p
                  key={i}
                  className={
                    l.includes("ERROR")
                      ? "text-red-600"
                      : l.includes("AVISO")
                        ? "text-amber-600"
                        : "text-zinc-600 dark:text-zinc-300"
                  }
                >
                  {l}
                </p>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
