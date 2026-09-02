import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrdenesCompra } from "@/lib/compras/repository";
import { DevolucionCompraFormClient } from "@/components/devoluciones/devolucion-compra-form-client";

export const metadata: Metadata = {
  title: "Nueva Devolución de Compra",
};

export default async function NuevaDevolucionCompraPage() {
  await getRoleOrRedirect("admin", "compra", "administracion");
  const ordenesCompra = await getOrdenesCompra();

  return <DevolucionCompraFormClient ordenesCompra={ordenesCompra} />;
}
