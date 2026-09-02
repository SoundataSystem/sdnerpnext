import Link from "next/link";
import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getResumenCompras } from "@/lib/compras/repository";
import { formatGs } from "@/lib/compras/calculos";

export const metadata: Metadata = {
  title: "Compras",
};

const MODULOS = [
  {
    href: "/compras/ordenes",
    titulo: "Órdenes de Compra",
    descripcion: "Listado, estados y seguimiento de compras",
  },
  {
    href: "/compras/ordenes/nuevo",
    titulo: "Nueva OC",
    descripcion: "Registrar una orden de compra con ítems",
  },
  {
    href: "/compras/recepciones",
    titulo: "Recepciones",
    descripcion: "Recepción de mercadería e ingreso a stock",
  },
  {
    href: "/compras/proveedores",
    titulo: "Proveedores",
    descripcion: "Alta, edición y búsqueda de proveedores",
  },
  {
    href: "/compras/pagos",
    titulo: "Pagos",
    descripcion: "Cuentas por pagar y pagos a proveedores",
  },
];

export default async function ComprasIndex() {
  await getRoleOrRedirect("admin", "compra", "administracion", "recepcion_compras");
  const resumen = await getResumenCompras();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo de Compras
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Órdenes de compra, recepción de mercadería y pagos a proveedores
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          {
            label: "Proveedores",
            value: resumen.total_proveedores.toLocaleString(),
          },
          {
            label: "OC en borrador",
            value: resumen.ocs_borrador.toLocaleString(),
          },
          {
            label: "OC pendientes",
            value: resumen.ocs_pendientes.toLocaleString(),
          },
          {
            label: "OC ingresadas",
            value: resumen.ocs_ingresadas.toLocaleString(),
          },
          {
            label: "OC canceladas",
            value: resumen.ocs_canceladas.toLocaleString(),
          },
          {
            label: "CxP pendiente",
            value: formatGs(resumen.total_cp_pendiente),
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
