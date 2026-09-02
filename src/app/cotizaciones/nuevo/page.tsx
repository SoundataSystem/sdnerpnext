import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getClientes } from "@/lib/ventas/repository";
import { getProductosVenta } from "@/lib/ventas/repository";
import { CotizacionFormClient } from "@/components/cotizaciones/cotizacion-form-client";

export const metadata: Metadata = {
  title: "Nueva Cotización",
};

export default async function NuevaCotizacionPage() {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const [clientes, productos] = await Promise.all([
    getClientes(),
    getProductosVenta(),
  ]);

  return (
    <CotizacionFormClient
      clientes={clientes}
      productos={productos}
      numeroPreview="CTZ-..."
    />
  );
}
