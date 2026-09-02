import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/devoluciones", label: "Inicio" },
  { href: "/devoluciones/ventas", label: "Devoluciones de Venta" },
  { href: "/devoluciones/ventas/nuevo", label: "Nueva Devolución Venta" },
  { href: "/devoluciones/compras", label: "Devoluciones de Compra" },
  { href: "/devoluciones/compras/nuevo", label: "Nueva Devolución Compra" },
];

export default async function DevolucionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-50 dark:text-zinc-900">
              P
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Devoluciones
            </span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="hidden text-xs text-zinc-400 sm:block dark:text-zinc-500">
            {user?.nombre} {user?.apellido} ·{" "}
            <span className="capitalize">
              {user?.rol?.replaceAll("_", " ")}
            </span>
          </p>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
