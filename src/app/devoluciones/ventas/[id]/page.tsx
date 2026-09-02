import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getDevolucionVenta } from "@/lib/devoluciones/repository";
import { DevolucionVentaDetalleClient } from "@/components/devoluciones/devolucion-venta-detalle-client";

export const metadata: Metadata = {
  title: "Detalle de Devolución de Venta",
};

export default async function DevolucionVentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const { id } = await params;
  const devolucion = await getDevolucionVenta(id);
  if (!devolucion) notFound();

  return <DevolucionVentaDetalleClient devolucion={devolucion} />;
}
