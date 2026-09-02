import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getDevolucionCompra } from "@/lib/devoluciones/repository";
import { DevolucionCompraDetalleClient } from "@/components/devoluciones/devolucion-compra-detalle-client";

export const metadata: Metadata = {
  title: "Detalle de Devolución de Compra",
};

export default async function DevolucionCompraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getRoleOrRedirect("admin", "compra", "administracion");
  const { id } = await params;
  const devolucion = await getDevolucionCompra(id);
  if (!devolucion) notFound();

  return <DevolucionCompraDetalleClient devolucion={devolucion} />;
}
