import Link from "next/link";
import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getResumenServicios } from "@/lib/servicios/repository";

export const metadata: Metadata = {
  title: "Servicios y Postventa",
};

const MODULOS = [
  {
    href: "/servicios/ordenes",
    titulo: "Órdenes de Servicio",
    descripcion: "Reparaciones, mantenimiento y garantías con técnicos asignados",
  },
  {
    href: "/servicios/tecnicos",
    titulo: "Técnicos",
    descripcion: "Alta y gestión del equipo técnico",
  },
  {
    href: "/servicios/instalaciones",
    titulo: "Instalaciones",
    descripcion: "Programación y seguimiento de instalaciones",
  },
  {
    href: "/servicios/garantias",
    titulo: "Garantías",
    descripcion: "Emisión, validación y vigencia de garantías",
  },
  {
    href: "/servicios/tickets",
    titulo: "Soporte",
    descripcion: "Tickets de soporte y atención al cliente",
  },
  {
    href: "/servicios/rmas",
    titulo: "RMA",
    descripcion: "Autorización de devolución de mercadería y trackeo del flujo",
  },
];

export default async function ServiciosIndex() {
  await getRoleOrRedirect("admin", "vendedor", "servicio_tecnico", "supervisor_tecnico");
  const resumen = await getResumenServicios();

  const cards = [
    {
      label: "O.S. pendientes",
      value: resumen.ordenes_pendientes.toLocaleString(),
    },
    {
      label: "O.S. en progreso",
      value: resumen.ordenes_en_progreso.toLocaleString(),
    },
    {
      label: "Instalaciones",
      value: resumen.instalaciones_programadas.toLocaleString(),
    },
    {
      label: "Tickets abiertos",
      value: resumen.tickets_abiertos.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo de Servicios y Postventa
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Órdenes de servicio, técnicos, instalaciones, garantías, soporte y RMA
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
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