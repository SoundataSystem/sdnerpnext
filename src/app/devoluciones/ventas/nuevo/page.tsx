import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrdenes } from "@/lib/ventas/repository";
import { DevolucionVentaFormClient } from "@/components/devoluciones/devolucion-venta-form-client";

export const metadata: Metadata = {
  title: "Nueva Devolución de Venta",
};

export default async function NuevaDevolucionVentaPage() {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const ordenes = await getOrdenes();

  return <DevolucionVentaFormClient ordenes={ordenes} />;
}
