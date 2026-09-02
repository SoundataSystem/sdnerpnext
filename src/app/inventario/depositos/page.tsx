import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getDepositosInventario } from "@/lib/inventario/repository";
import { DepositosClient } from "@/components/inventario/depositos-client";

export const metadata: Metadata = {
  title: "Depósitos",
};

export default async function DepositosPage() {
  await getRoleOrRedirect("admin", "deposito", "administracion", "logistica");
  const depositos = await getDepositosInventario();

  return <DepositosClient depositos={depositos} />;
}