import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getPagosProveedor,
  getCuentasPagarVentana,
  getMetodosPago,
} from "@/lib/compras/repository";
import { PagosClient } from "@/components/compras/pagos-client";

export const metadata: Metadata = {
  title: "Pagos a Proveedores",
};

export default async function PagosPage() {
  await getRoleOrRedirect("admin", "compra", "administracion");
  const [pagos, cuentas, metodosPago] = await Promise.all([
    getPagosProveedor(),
    getCuentasPagarVentana(),
    getMetodosPago(),
  ]);

  return <PagosClient pagos={pagos} cuentas={cuentas} metodosPago={metodosPago} />;
}