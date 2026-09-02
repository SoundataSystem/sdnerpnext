import Link from "next/link";
import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getResumenCotizaciones } from "@/lib/cotizaciones/repository";
import { formatGs } from "@/lib/cotizaciones/calculos";

export const metadata: Metadata = {
  title: "Cotizaciones",
};

const MODULOS = [
  {
    href: "/cotizaciones/listado",
    titulo: "Listado de Cotizaciones",
    descripcion: "Historial, estados y seguimiento",
  },
  {
    href: "/cotizaciones/nuevo",
    titulo: "Nueva Cotización",
    descripcion: "Crear una cotización con ítems y descuento",
  },
];

export default async function CotizacionesIndex() {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const resumen = await getResumenCotizaciones();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo de Cotizaciones
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Presupuestos a clientes y seguimiento de estados
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total cotizaciones", value: resumen.total_cotizaciones.toLocaleString() },
          { label: "Pendientes", value: resumen.pendientes.toLocaleString() },
          { label: "Aprobadas", value: resumen.aprobadas.toLocaleString() },
          { label: "Monto pendiente", value: formatGs(resumen.monto_pendiente) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {card.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULOS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <h2 className="text-base font-semibold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-300">
              {m.titulo}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {m.descripcion}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
