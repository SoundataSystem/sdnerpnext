import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getDevolucionesCompra } from "@/lib/devoluciones/repository";
import { DevolucionesComprasListaClient } from "@/components/devoluciones/devoluciones-compras-lista-client";

export const metadata: Metadata = {
  title: "Devoluciones de Compra",
};

export default async function DevolucionesComprasPage() {
  await getRoleOrRedirect("admin", "compra", "administracion");
  const devoluciones = await getDevolucionesCompra();

  return <DevolucionesComprasListaClient devoluciones={devoluciones} />;
}
