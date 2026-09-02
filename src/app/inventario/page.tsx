import Link from "next/link";
import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getResumenInventario } from "@/lib/inventario/repository";
import { formatCantidad } from "@/lib/inventario/calculos";

export const metadata: Metadata = {
  title: "Inventario",
};

const MODULOS = [
  {
    href: "/inventario/productos",
    titulo: "Productos",
    descripcion: "Catálogo, precios y costos de productos",
  },
  {
    href: "/inventario/stock",
    titulo: "Stock por Depósito",
    descripcion: "Existencias de productos por depósito",
  },
  {
    href: "/inventario/depositos",
    titulo: "Depósitos",
    descripcion: "Alta y edición de depósitos/almacenes",
  },
  {
    href: "/inventario/ajustes",
    titulo: "Ajustes de Stock",
    descripcion: "Conteos, mermas y correcciones con aprobación",
  },
  {
    href: "/inventario/transferencias",
    titulo: "Transferencias",
    descripcion: "Mover stock entre depósitos (con seriales)",
  },
  {
    href: "/inventario/movimientos",
    titulo: "Movimientos",
    descripcion: "Historial de entradas y salidas",
  },
];

export default async function InventarioIndex() {
  await getRoleOrRedirect("admin", "deposito", "administracion", "logistica");
  const resumen = await getResumenInventario();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo de Inventario
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Productos, stock por depósito, ajustes y movimientos
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          { label: "Productos", value: resumen.total_productos.toLocaleString() },
          { label: "Activos", value: resumen.productos_activos.toLocaleString() },
          { label: "Depósitos", value: resumen.total_depositos.toLocaleString() },
          { label: "Bajo mínimo", value: resumen.bajo_minimo.toLocaleString() },
          { label: "Stock total", value: formatCantidad(resumen.stock_total) },
          { label: "Ajustes pendientes", value: resumen.ajustes_pendientes.toLocaleString() },
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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