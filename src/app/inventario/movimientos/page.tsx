import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getMovimientosInventarioPage } from "@/lib/inventario/repository";
import { MovimientosClient } from "@/components/inventario/movimientos-client";

export const metadata: Metadata = {
  title: "Movimientos",
};

export default async function MovimientosPage(props: {
  searchParams: Promise<{
    tipo?: string;
    busqueda?: string;
    page?: string;
  }>;
}) {
  await getRoleOrRedirect("admin", "deposito", "administracion", "logistica");
  const { tipo, busqueda, page } = await props.searchParams;
  const p = Math.max(1, Number(page) || 1);
  const pageSize = 20;
  const { items, total } = await getMovimientosInventarioPage({
    page: p,
    pageSize,
    tipo: tipo || undefined,
    busqueda: busqueda || undefined,
  });

  return (
    <MovimientosClient
      items={items}
      total={total}
      page={p}
      pageSize={pageSize}
      tipo={tipo || "todos"}
      busqueda={busqueda || ""}
    />
  );
}