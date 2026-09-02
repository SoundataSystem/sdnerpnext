import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getClientes,
  getProductosVenta,
  getVendedores,
  getMetodosPago,
  getConfigVentas,
} from "@/lib/ventas/repository";
import { OrdenFormClient } from "@/components/ventas/orden-form-client";

export const metadata: Metadata = {
  title: "Nueva Orden de Venta",
};

export default async function NuevaVentaPage() {
  const usuario = await getRoleOrRedirect("admin", "vendedor", "cajero");
  const [clientes, productos, vendedores, metodosPago, configVentas] =
    await Promise.all([
      getClientes(),
      getProductosVenta(),
      getVendedores(),
      getMetodosPago(),
      getConfigVentas(),
    ]);

  return (
    <OrdenFormClient
      clientes={clientes}
      productos={productos}
      vendedores={vendedores}
      metodosPago={metodosPago}
      configVentas={configVentas}
      vendedorActualId={usuario.id}
      vendedorActualNombre={`${usuario.nombre} ${usuario.apellido}`.trim()}
    />
  );
}
