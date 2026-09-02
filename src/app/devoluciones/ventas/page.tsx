import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getDevolucionesVenta } from "@/lib/devoluciones/repository";
import { DevolucionesVentasListaClient } from "@/components/devoluciones/devoluciones-ventas-lista-client";

export const metadata: Metadata = {
  title: "Devoluciones de Venta",
};

export default async function DevolucionesVentasPage() {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const devoluciones = await getDevolucionesVenta();

  return <DevolucionesVentasListaClient devoluciones={devoluciones} />;
}
