import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrdenCompra } from "@/lib/compras/repository";
import { OcDetalleClient } from "@/components/compras/oc-detalle-client";

export const metadata: Metadata = {
  title: "Detalle de Orden de Compra",
};

export default async function OcDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getRoleOrRedirect("admin", "compra", "administracion", "recepcion_compras");
  const { id } = await params;
  const oc = await getOrdenCompra(id);
  if (!oc) notFound();

  return <OcDetalleClient oc={oc} />;
}
