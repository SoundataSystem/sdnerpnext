import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getStockPorDepositoPage,
  getDepositosInventario,
} from "@/lib/inventario/repository";
import { StockClient } from "@/components/inventario/stock-client";

export const metadata: Metadata = {
  title: "Stock por Depósito",
};

export default async function StockPage(props: {
  searchParams: Promise<{
    depositoId?: string;
    busqueda?: string;
    page?: string;
  }>;
}) {
  await getRoleOrRedirect("admin", "deposito", "administracion", "logistica");
  const { depositoId, busqueda, page } = await props.searchParams;
  const p = Math.max(1, Number(page) || 1);
  const pageSize = 20;

  const [stockResult, depositos] = await Promise.all([
    getStockPorDepositoPage({
      page: p,
      pageSize,
      depositoId: depositoId || undefined,
      busqueda: busqueda || undefined,
    }),
    getDepositosInventario(),
  ]);

  return (
    <StockClient
      items={stockResult.items}
      total={stockResult.total}
      page={p}
      pageSize={20}
      busqueda={busqueda || ""}
      depositoId={depositoId || "todos"}
      depositos={depositos}
    />
  );
}