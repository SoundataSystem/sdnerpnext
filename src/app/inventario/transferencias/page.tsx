import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getDepositosInventario,
  getProductosInventario,
  getStockPorDeposito,
  getSerialesDisponibles,
} from "@/lib/inventario/repository";
import { TransferenciasClient } from "@/components/inventario/transferencias-client";

export const metadata: Metadata = {
  title: "Transferencias",
};

export default async function TransferenciasPage() {
  await getRoleOrRedirect("admin", "deposito", "administracion", "logistica", "cajero");
  const [depositos, productos, stock, seriales] = await Promise.all([
    getDepositosInventario(),
    getProductosInventario(),
    getStockPorDeposito(),
    getSerialesDisponibles(),
  ]);

  return (
    <TransferenciasClient
      depositos={depositos}
      productos={productos}
      stock={stock}
      seriales={seriales}
    />
  );
}
