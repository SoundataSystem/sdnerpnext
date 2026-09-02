import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getProveedores } from "@/lib/compras/repository";
import { ProveedoresClient } from "@/components/compras/proveedores-client";

export const metadata: Metadata = {
  title: "Proveedores",
};

export default async function ProveedoresPage() {
  await getRoleOrRedirect("admin", "compra", "administracion");
  const proveedores = await getProveedores();

  return <ProveedoresClient proveedores={proveedores} />;
}
