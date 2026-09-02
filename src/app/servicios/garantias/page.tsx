import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getGarantias } from "@/lib/servicios/repository";
import { getOrdenes } from "@/lib/ventas/repository";
import { GarantiasClient } from "@/components/servicios/garantias-client";

export const metadata: Metadata = {
  title: "Garantías",
};

export default async function GarantiasPage() {
  await getRoleOrRedirect("admin", "vendedor", "servicio_tecnico", "supervisor_tecnico");
  const [garantias, ordenes] = await Promise.all([
    getGarantias(),
    getOrdenes(),
  ]);

  return <GarantiasClient garantias={garantias} ordenes={ordenes} />;
}
