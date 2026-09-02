import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ClipboardList,
  DollarSign,
  FileText,
  Package,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Ticket,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { getDashboardData } from "@/lib/dashboard/repository";
import { getNotificaciones } from "@/lib/notificaciones/repository";
import { formatGs } from "@/lib/ventas/calculos";
import type { DashboardActividad } from "@/lib/dashboard/repository";

export const metadata: Metadata = {
  title: "Dashboard",
};

const MODULOS = [
  {
    href: "/contabilidad",
    titulo: "Contabilidad",
    descripcion: "Plan de cuentas, asientos y reportes",
  },
  {
    href: "/ventas",
    titulo: "Ventas",
    descripcion: "Órdenes, punto de venta, clientes y caja",
  },
  {
    href: "/compras",
    titulo: "Compras",
    descripcion: "Órdenes de compra, recepción y pagos a proveedores",
  },
  {
    href: "/inventario",
    titulo: "Inventario",
    descripcion: "Productos, stock por depósito, ajustes y movimientos",
  },
  {
    href: "/cotizaciones",
    titulo: "Cotizaciones",
    descripcion: "Presupuestos a clientes y seguimiento de estados",
  },
  {
    href: "/devoluciones",
    titulo: "Devoluciones",
    descripcion: "Devoluciones de ventas y compras con afectación de stock",
  },
  {
    href: "/servicios",
    titulo: "Servicios y Postventa",
    descripcion: "Órdenes de servicio, técnicos, garantías, soporte y RMA",
  },
  {
    href: "/configuracion",
    titulo: "Configuración",
    descripcion: "Parámetros globales: costos, comisiones y documentos",
  },
  {
    href: "/usuarios",
    titulo: "Usuarios",
    descripcion: "Cuentas, roles y acceso al sistema",
  },
  {
    href: "/auditoria",
    titulo: "Auditoría",
    descripcion: "Actividad de usuarios y log de auditoría",
  },
  {
    href: "/pegasus",
    titulo: "Importación Pegasus",
    descripcion: "Migración de datos desde el ERP anterior",
  },
];

const TIPO_ACTIVIDAD: Record<
  DashboardActividad["tipo"],
  { icono: typeof ShoppingCart; label: string }
> = {
  venta: { icono: ShoppingCart, label: "Venta" },
  compra: { icono: Package, label: "Compra" },
  cotizacion: { icono: FileText, label: "Cotización" },
  devolucion: { icono: RotateCcw, label: "Devolución" },
  orden_servicio: { icono: Wrench, label: "Orden de servicio" },
  ticket: { icono: Ticket, label: "Ticket" },
  rma: { icono: ClipboardList, label: "RMA" },
};

function estadoColor(estado: string): string {
  const e = estado.toLowerCase();
  if (e.includes("cancel") || e.includes("rechaz") || e.includes("anul"))
    return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (e.includes("complet") || e.includes("aprob") || e.includes("cerrad"))
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (e.includes("pend") || e.includes("program") || e.includes("borrador"))
    return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
}

function formatearFecha(d: Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function KpiCard({
  label,
  value,
  alerta = false,
}: {
  label: string;
  value: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 dark:bg-zinc-950 ${
        alerta
          ? "border-red-200 dark:border-red-900"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          alerta
            ? "text-red-600 dark:text-red-400"
            : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  const [data, notif] = await Promise.all([
    getDashboardData(),
    user
      ? getNotificaciones(user.id).catch(() => ({ items: [], no_leidas: 0 }))
      : Promise.resolve({ items: [], no_leidas: 0 }),
  ]);
  const noLeidas = notif.no_leidas;

  const alertas: { texto: string; href: string }[] = [];
  if (data.inventario.bajo_minimo > 0)
    alertas.push({
      texto: `${data.inventario.bajo_minimo} producto(s) bajo el stock mínimo`,
      href: "/inventario/stock",
    });
  if (data.inventario.ajustes_pendientes > 0)
    alertas.push({
      texto: `${data.inventario.ajustes_pendientes} ajuste(s) de inventario pendientes de aprobación`,
      href: "/inventario/ajustes",
    });
  if (data.compras.ocs_pendientes > 0)
    alertas.push({
      texto: `${data.compras.ocs_pendientes} órdenes de compra en trámite`,
      href: "/compras/ordenes",
    });
  if (data.servicios.rmas_pendientes > 0)
    alertas.push({
      texto: `${data.servicios.rmas_pendientes} RMA(s) pendientes de gestión`,
      href: "/servicios/rmas",
    });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-50 dark:text-zinc-900">
            P
          </span>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              PRODQA v2
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Panel principal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/notificaciones"
            className="relative rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            {noLeidas > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {noLeidas}
              </span>
            )}
          </Link>
          <div className="text-right">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {user?.nombre} {user?.apellido}
            </p>
            <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
              {user?.rol?.replaceAll("_", " ")}
            </p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Bienvenido, {user?.nombre ?? "admin"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Resumen general de la operación al día de hoy.
          </p>
        </div>

        {alertas.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Necesita atención</h3>
            </div>
            <ul className="mt-2 space-y-1">
              {alertas.map((a) => (
                <li key={a.href + a.texto}>
                  <Link
                    href={a.href}
                    className="text-sm text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
                  >
                    {a.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Seccion titulo="Finanzas">
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Cobrado hoy"
              value={formatGs(data.ventas.total_cobrado_hoy)}
            />
            <KpiCard
              label="Ventas del mes"
              value={formatGs(data.ventas_mes)}
            />
            <KpiCard
              label="Cuentas por cobrar"
              value={formatGs(data.contabilidad.total_cxc)}
              alerta={data.contabilidad.total_cxc > 0}
            />
            <KpiCard
              label="Cuentas por pagar"
              value={formatGs(data.contabilidad.total_cxp)}
            />
          </div>
        </Seccion>

        <Seccion titulo="Operación">
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Órdenes de venta pendientes"
              value={data.ventas.ordenes_pendientes.toLocaleString()}
            />
            <KpiCard
              label="Órdenes de compra en trámite"
              value={data.compras.ocs_pendientes.toLocaleString()}
            />
            <KpiCard
              label="Productos activos"
              value={data.inventario.productos_activos.toLocaleString()}
            />
            <KpiCard
              label="Bajo stock mínimo"
              value={data.inventario.bajo_minimo.toLocaleString()}
              alerta={data.inventario.bajo_minimo > 0}
            />
          </div>
        </Seccion>

        <Seccion titulo="Comercial y postventa">
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Cotizaciones pendientes"
              value={data.cotizaciones.pendientes.toLocaleString()}
            />
            <KpiCard
              label="Órdenes de servicio activas"
              value={(
                data.servicios.ordenes_pendientes +
                data.servicios.ordenes_en_progreso
              ).toLocaleString()}
            />
            <KpiCard
              label="Tickets abiertos"
              value={data.servicios.tickets_abiertos.toLocaleString()}
            />
            <KpiCard
              label="RMAs pendientes"
              value={data.servicios.rmas_pendientes.toLocaleString()}
              alerta={data.servicios.rmas_pendientes > 0}
            />
          </div>
        </Seccion>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Seccion titulo="Actividad reciente">
            <div className="mt-4 space-y-1">
              {data.actividad.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Sin actividad registrada todavía.
                </p>
              ) : (
                data.actividad.map((a) => {
                  const conf = TIPO_ACTIVIDAD[a.tipo];
                  const Icono = conf.icono;
                  return (
                    <Link
                      key={`${a.tipo}-${a.titulo}-${a.fecha.getTime()}`}
                      href={a.href}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        <Icono className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {a.titulo}
                        </p>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {a.detalle}
                        </p>
                      </div>
                      <span
                        className={`hidden rounded-full px-2 py-0.5 text-xs font-medium capitalize sm:inline ${estadoColor(a.estado)}`}
                      >
                        {a.estado.replaceAll("_", " ")}
                      </span>
                      <span className="text-right">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                          {a.monto > 0 ? formatGs(a.monto) : conf.label}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {formatearFecha(a.fecha)}
                        </p>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </Seccion>

          <div className="flex flex-col gap-6 lg:col-span-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    Indicadores
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Comparativa del mes
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-zinc-400" />
              </div>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                    Ventas del mes
                  </dt>
                  <dd className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatGs(data.ventas_mes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                    Compras del mes
                  </dt>
                  <dd className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {formatGs(data.compras_mes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <Receipt className="h-4 w-4 text-violet-500" />
                    Asientos contabilizados
                  </dt>
                  <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {data.contabilidad.asientos_contabilizados.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <DollarSign className="h-4 w-4 text-amber-500" />
                    Devuelto aprobado
                  </dt>
                  <dd className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {formatGs(data.devoluciones.monto_devuelto)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <Package className="h-4 w-4 text-sky-500" />
                    Stock total (unidades)
                  </dt>
                  <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {data.inventario.stock_total.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Módulos
                </h2>
                <ArrowRight className="h-5 w-5 text-zinc-400" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {MODULOS.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="group rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    <p className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                      {m.titulo}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {m.descripcion}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
