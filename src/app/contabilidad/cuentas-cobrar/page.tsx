import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getCuentasCobrar,
  getResumenCuentas,
} from "@/lib/contabilidad/repository";
import { CuentasClient } from "@/components/contabilidad/cuentas-client";

export const metadata: Metadata = {
  title: "Cuentas por Cobrar",
};

export default async function CuentasCobrarPage() {
  await getRoleOrRedirect("admin", "contabilidad", "vendedor", "cajero");
  const [cuentas, resumen] = await Promise.all([
    getCuentasCobrar(),
    getResumenCuentas(),
  ]);

  return <CuentasClient tipo="cobrar" resumen={resumen} cuentas={cuentas} />;
}
