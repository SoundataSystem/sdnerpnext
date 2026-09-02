import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getClientesPage } from "@/lib/ventas/repository";
import { ClientesClient } from "@/components/ventas/clientes-client";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function ClientesPage(props: {
  searchParams: Promise<{ busqueda?: string; page?: string; pageSize?: string }>;
}) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const { busqueda, page, pageSize: qsPageSize } = await props.searchParams;
  const p = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(qsPageSize) || 20));
  const { items, total } = await getClientesPage({
    page: p,
    pageSize,
    busqueda: busqueda || undefined,
  });

  return (
    <ClientesClient
      items={items}
      total={total}
      page={p}
      pageSize={pageSize}
      busqueda={busqueda || ""}
    />
  );
}