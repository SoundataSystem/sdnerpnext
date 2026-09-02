import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getRmas } from "@/lib/servicios/repository";
import { getClientes, getProductosVenta } from "@/lib/ventas/repository";
import { RmasClient } from "@/components/servicios/rmas-client";

export const metadata: Metadata = {
  title: "RMA",
};

export default async function RmasPage() {
  await getRoleOrRedirect("admin", "vendedor", "servicio_tecnico", "supervisor_tecnico");
  const [rmas, clientes, productos] = await Promise.all([
    getRmas(),
    getClientes(),
    getProductosVenta(),
  ]);

  return <RmasClient rmas={rmas} clientes={clientes} productos={productos} />;
}
