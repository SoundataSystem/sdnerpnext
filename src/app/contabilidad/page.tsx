import Link from "next/link";
import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getResumenCuentas } from "@/lib/contabilidad/repository";
import { formatPyG } from "@/lib/contabilidad/calculos";

export const metadata: Metadata = {
  title: "Contabilidad",
};

const MODULOS = [
  {
    href: "/contabilidad/plan-cuentas",
    titulo: "Plan de Cuentas",
    descripcion: "Catálogo jerárquico de cuentas contables",
  },
  {
    href: "/contabilidad/asientos",
    titulo: "Asientos Contables",
    descripcion: "Registro de asientos de diario (partida doble)",
  },
  {
    href: "/contabilidad/libro-diario",
    titulo: "Libro Diario",
    descripcion: "Mayor de movimientos por cuenta",
  },
  {
    href: "/contabilidad/balance-general",
    titulo: "Balance General",
    descripcion: "Situación patrimonial con fecha de corte",
  },
  {
    href: "/contabilidad/estado-resultados",
    titulo: "Estado de Resultados",
    descripcion: "Pérdidas y ganancias (P&L)",
  },
  {
    href: "/contabilidad/cuentas-cobrar",
    titulo: "Cuentas por Cobrar",
    descripcion: "Saldos de clientes y antigüedad",
  },
  {
    href: "/contabilidad/cuentas-pagar",
    titulo: "Cuentas por Pagar",
    descripcion: "Saldos a proveedores y antigüedad",
  },
];

export default async function ContabilidadIndex() {
  await getRoleOrRedirect("admin", "contabilidad");
  const resumen = await getResumenCuentas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo de Contabilidad
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Gestión del plan de cuentas, asientos y reportes financieros
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Cuentas por cobrar",
            value: formatPyG(resumen.cxc_pendiente),
            alerta: resumen.cxc_pendiente > 0,
            href: "/contabilidad/cuentas-cobrar",
          },
          {
            label: "CxC vencido",
            value: formatPyG(resumen.cxc_vencido),
            alerta: resumen.cxc_vencido > 0,
            href: "/contabilidad/cuentas-cobrar",
          },
          {
            label: "Cuentas por pagar",
            value: formatPyG(resumen.cxp_pendiente),
            alerta: resumen.cxp_pendiente > 0,
            href: "/contabilidad/cuentas-pagar",
          },
          {
            label: "CxP vencido",
            value: formatPyG(resumen.cxp_vencido),
            alerta: resumen.cxp_vencido > 0,
            href: "/contabilidad/cuentas-pagar",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-2xl border bg-white p-5 transition hover:shadow-sm dark:bg-zinc-950 ${
              card.alerta
                ? "border-red-200 dark:border-red-900"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {card.label}
            </p>
            <p
              className={`mt-1 text-xl font-semibold ${
                card.alerta
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {card.value}
            </p>
          </Link>
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
