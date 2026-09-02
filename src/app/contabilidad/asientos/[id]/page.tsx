import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getAsiento } from "@/lib/contabilidad/repository";

export const metadata: Metadata = {
  title: "Detalle de Asiento",
};

export default async function AsientoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getRoleOrRedirect("admin", "contabilidad");
  const { id } = await params;
  const asiento = await getAsiento(id);
  if (!asiento) notFound();

  const totalDebe = asiento.detalles.reduce((s, d) => s + d.debe, 0);
  const totalHaber = asiento.detalles.reduce((s, d) => s + d.haber, 0);

  const ESTADO_BADGE: Record<string, string> = {
    borrador:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    contabilizado:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    cancelado: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/contabilidad/asientos"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Asiento {asiento.numero_asiento}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{asiento.concepto}</p>
          </div>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            ESTADO_BADGE[asiento.estado] ??
            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {asiento.estado}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Fecha</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              {new Date(asiento.fecha).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Referencia</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              {asiento.referencia_tipo
                ? `${asiento.referencia_tipo}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Total Debe</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              ₲ {totalDebe.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Total Haber</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              ₲ {totalHaber.toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Detalle ({asiento.detalles.length} líneas)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Cuenta</th>
                <th className="px-3 py-2 text-right font-medium">Debe</th>
                <th className="px-3 py-2 text-right font-medium">Haber</th>
              </tr>
            </thead>
            <tbody>
              {asiento.detalles.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {d.cuenta?.codigo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                    {d.cuenta?.nombre ?? "Cuenta eliminada"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {d.debe > 0 ? `₲ ${d.debe.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {d.haber > 0 ? `₲ ${d.haber.toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}