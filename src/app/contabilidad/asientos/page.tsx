import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getAsientos } from "@/lib/contabilidad/repository";
import { AsientosListaClient } from "@/components/contabilidad/asientos-lista-client";

export const metadata: Metadata = {
  title: "Asientos Contables",
};

export default async function AsientosPage() {
  await getRoleOrRedirect("admin", "contabilidad");
  const asientos = await getAsientos();

  return <AsientosListaClient asientos={asientos} />;
}