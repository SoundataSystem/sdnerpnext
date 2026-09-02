import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getCotizacion } from "@/lib/cotizaciones/repository";
import { CotizacionDetalleClient } from "@/components/cotizaciones/cotizacion-detalle-client";

export const metadata: Metadata = {
  title: "Detalle de Cotización",
};

export default async function CotizacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const { id } = await params;
  const cotizacion = await getCotizacion(id);
  if (!cotizacion) notFound();

  return <CotizacionDetalleClient cotizacion={cotizacion} />;
}
