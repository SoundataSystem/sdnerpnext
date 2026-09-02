import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrden } from "@/lib/ventas/repository";
import { OrdenDetalleClient } from "@/components/ventas/orden-detalle-client";

export const metadata: Metadata = {
  title: "Detalle de Orden",
};

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getRoleOrRedirect("admin", "vendedor", "cajero");
  const { id } = await params;
  const orden = await getOrden(id);
  if (!orden) notFound();

  return <OrdenDetalleClient orden={orden} esAdmin={usuario.rol === "admin"} />;
}