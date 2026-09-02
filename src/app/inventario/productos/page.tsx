import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getProductosInventarioPage } from "@/lib/inventario/repository";
import { ProductosClient } from "@/components/inventario/productos-client";

export const metadata: Metadata = {
  title: "Productos",
};

export default async function ProductosPage(props: {
  searchParams: Promise<{ busqueda?: string; page?: string }>;
}) {
  await getRoleOrRedirect("admin", "deposito", "administracion", "logistica");
  const { busqueda, page } = await props.searchParams;
  const p = Math.max(1, Number(page) || 1);
  const pageSize = 20;
  const { items, total } = await getProductosInventarioPage({
    page: p,
    pageSize,
    busqueda: busqueda || undefined,
  });

  return (
    <ProductosClient
      items={items}
      total={total}
      page={p}
      pageSize={pageSize}
      busqueda={busqueda || ""}
    />
  );
}