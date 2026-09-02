import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getAsientos, getCuentas } from "@/lib/contabilidad/repository";
import { BalanceGeneralClient } from "@/components/contabilidad/balance-general-client";

export const metadata: Metadata = {
  title: "Balance General",
};

export default async function BalanceGeneralPage() {
  await getRoleOrRedirect("admin", "contabilidad");
  const [asientos, cuentas] = await Promise.all([getAsientos(), getCuentas()]);

  return <BalanceGeneralClient asientos={asientos} cuentas={cuentas} />;
}