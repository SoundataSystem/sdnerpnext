import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getCotizaciones } from "@/lib/cotizaciones/repository";
import { CotizacionesListaClient } from "@/components/cotizaciones/cotizaciones-lista-client";

export const metadata: Metadata = {
  title: "Cotizaciones",
};

export default async function CotizacionesListadoPage() {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const cotizaciones = await getCotizaciones();

  return <CotizacionesListaClient cotizaciones={cotizaciones} />;
}
