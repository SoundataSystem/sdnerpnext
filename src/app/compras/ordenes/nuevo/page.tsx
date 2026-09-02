import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getProveedores, getProductosCompra } from "@/lib/compras/repository";
import { OcFormClient } from "@/components/compras/oc-form-client";

export const metadata: Metadata = {
  title: "Nueva Orden de Compra",
};

export default async function NuevaOcPage() {
  await getRoleOrRedirect("admin", "compra", "administracion");
  const [proveedores, productos] = await Promise.all([
    getProveedores(),
    getProductosCompra(),
  ]);

  return <OcFormClient proveedores={proveedores} productos={productos} />;
}
