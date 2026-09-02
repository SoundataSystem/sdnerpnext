import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getOrden,
  getClientes,
  getProductosVenta,
  getVendedores,
  getMetodosPago,
  getConfigVentas,
} from "@/lib/ventas/repository";
import { OrdenEditarClient } from "@/components/ventas/orden-editar-client";

export const metadata: Metadata = {
  title: "Editar Orden de Venta",
};

export default async function EditarOrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getRoleOrRedirect("admin", "vendedor");
  const { id } = await params;

  const [orden, clientes, productos, vendedores, metodosPago, configVentas] =
    await Promise.all([
      getOrden(id),
      getClientes(),
      getProductosVenta(),
      getVendedores(),
      getMetodosPago(),
      getConfigVentas(),
    ]);

  if (!orden) notFound();

  return (
    <OrdenEditarClient
      orden={orden}
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