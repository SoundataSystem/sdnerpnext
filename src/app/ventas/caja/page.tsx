import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getCajaMovimientosPage,
  getMetodosPago,
  getOrdenesCobrables,
} from "@/lib/ventas/repository";
import { CajaClient } from "@/components/ventas/caja-client";

export const metadata: Metadata = {
  title: "Caja",
};

export default async function CajaPage(props: {
  searchParams: Promise<{
    busqueda?: string;
    estado?: string;
    page?: string;
  }>;
}) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const { busqueda, estado, page } = await props.searchParams;
  const p = Math.max(1, Number(page) || 1);
  const pageSize = 20;

  const [movimientosResult, metodosPago, ordenesCobrables] = await Promise.all([
    getCajaMovimientosPage({
      page: p,
      pageSize,
      busqueda: busqueda || undefined,
      estado: estado || undefined,
    }),
    getMetodosPago(),
    getOrdenesCobrables(),
  ]);

  return (
    <CajaClient
      items={movimientosResult.items}
      total={movimientosResult.total}
      page={p}
      pageSize={pageSize}
      busqueda={busqueda || ""}
      estado={estado || "todos"}
      metodosPago={metodosPago}
      ordenesCobrables={ordenesCobrables}
    />
  );
}