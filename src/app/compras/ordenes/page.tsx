import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrdenesCompra } from "@/lib/compras/repository";
import { OcsListaClient } from "@/components/compras/ocs-lista-client";

export const metadata: Metadata = {
  title: "Órdenes de Compra",
};

export default async function OrdenesCompraPage() {
  await getRoleOrRedirect("admin", "compra", "administracion", "recepcion_compras");
  const ocs = await getOrdenesCompra();

  return <OcsListaClient ocs={ocs} />;
}
