import Link from "next/link";
import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getResumenVentas } from "@/lib/ventas/repository";
import { formatGs } from "@/lib/ventas/calculos";

export const metadata: Metadata = {
  title: "Ventas",
};

const MODULOS = [
  {
    href: "/ventas/ordenes",
    titulo: "Órdenes de Venta",
    descripcion: "Listado, estados y seguimiento de ventas",
  },
  {
    href: "/ventas/ordenes/nuevo",
    titulo: "Nueva Venta",
    descripcion: "Punto de venta: registrar una orden con ítems",
  },
  {
    href: "/ventas/clientes",
    titulo: "Clientes",
    descripcion: "Alta, edición y búsqueda de clientes",
  },
  {
    href: "/ventas/caja",
    titulo: "Caja",
    descripcion: "Cobros, movimientos y anulaciones",
  },
];

export default async function VentasIndex() {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const resumen = await getResumenVentas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo de Ventas
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Órdenes, punto de venta, clientes y caja
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Clientes",
            value: resumen.total_clientes.toLocaleString(),
          },
          {
            label: "Órdenes pendientes",
            value: resumen.ordenes_pendientes.toLocaleString(),
          },
          {
            label: "Cobros hoy",
            value: resumen.caja_movimientos.toLocaleString(),
          },
          {
            label: "Cobrado hoy",
            value: formatGs(resumen.total_cobrado_hoy),
          },
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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