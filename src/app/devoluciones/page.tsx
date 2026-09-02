import Link from "next/link";
import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getResumenDevoluciones } from "@/lib/devoluciones/repository";
import { formatGs } from "@/lib/devoluciones/calculos";

export const metadata: Metadata = {
  title: "Devoluciones",
};

const MODULOS = [
  {
    href: "/devoluciones/ventas",
    titulo: "Devoluciones de Venta",
    descripcion: "Devoluciones de clientes: registro, aprobación y reposición de stock",
  },
  {
    href: "/devoluciones/ventas/nuevo",
    titulo: "Nueva Devolución de Venta",
    descripcion: "Registrar una devolución asociada a una orden",
  },
  {
    href: "/devoluciones/compras",
    titulo: "Devoluciones de Compra",
    descripcion: "Devoluciones a proveedores sobre órdenes de compra",
  },
  {
    href: "/devoluciones/compras/nuevo",
    titulo: "Nueva Devolución de Compra",
    descripcion: "Registrar una devolución a proveedor sobre una OC",
  },
];

export default async function DevolucionesIndex() {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const resumen = await getResumenDevoluciones();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo de Devoluciones
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Devoluciones de ventas y compras con aprobación y afectación de stock
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Ventas pendientes",
            value: resumen.ventas_pendientes.toLocaleString(),
          },
          {
            label: "Ventas aprobadas",
            value: resumen.ventas_aprobadas.toLocaleString(),
          },
          {
            label: "Compras pendientes",
            value: resumen.compras_pendientes.toLocaleString(),
          },
          {
            label: "Monto devuelto",
            value: formatGs(resumen.monto_devuelto),
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
