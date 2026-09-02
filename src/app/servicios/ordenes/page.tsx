import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrdenesServicio, getTecnicos } from "@/lib/servicios/repository";
import { getClientes, getProductosVenta } from "@/lib/ventas/repository";
import { OrdenesServicioClient } from "@/components/servicios/ordenes-servicio-client";

export const metadata: Metadata = {
  title: "Órdenes de Servicio",
};

export default async function OrdenesServicioPage() {
  await getRoleOrRedirect("admin", "vendedor", "servicio_tecnico", "supervisor_tecnico");
  const [ordenes, clientes, productos, tecnicos] = await Promise.all([
    getOrdenesServicio(),
    getClientes(),
    getProductosVenta(),
    getTecnicos(),
  ]);

  return (
    <OrdenesServicioClient
      ordenes={ordenes}
      clientes={clientes}
      productos={productos}
      tecnicos={tecnicos}
    />
  );
}
