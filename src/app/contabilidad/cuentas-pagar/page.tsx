import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getCuentasPagar,
  getResumenCuentas,
} from "@/lib/contabilidad/repository";
import { CuentasClient } from "@/components/contabilidad/cuentas-client";

export const metadata: Metadata = {
  title: "Cuentas por Pagar",
};

export default async function CuentasPagarPage() {
  await getRoleOrRedirect("admin", "contabilidad", "cajero");
  const [cuentas, resumen] = await Promise.all([
    getCuentasPagar(),
    getResumenCuentas(),
  ]);

  return <CuentasClient tipo="pagar" resumen={resumen} cuentas={cuentas} />;
}
