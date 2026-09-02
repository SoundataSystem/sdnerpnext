import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrdenesPage } from "@/lib/ventas/repository";
import { OrdenesListaClient } from "@/components/ventas/ordenes-lista-client";

export const metadata: Metadata = {
  title: "Órdenes de Venta",
};

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; page?: string }>;
}) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const sp = await searchParams;
  const estado = typeof sp.estado === "string" ? sp.estado : "todos";
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await getOrdenesPage({ estado, page });

  return <OrdenesListaClient data={data} estado={estado} />;
}