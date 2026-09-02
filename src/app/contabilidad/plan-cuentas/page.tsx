import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getCuentas } from "@/lib/contabilidad/repository";
import { PlanCuentasClient } from "@/components/contabilidad/plan-cuentas-client";

export const metadata: Metadata = {
  title: "Plan de Cuentas",
};

export default async function PlanCuentasPage() {
  await getRoleOrRedirect("admin", "contabilidad");
  const cuentas = await getCuentas();

  return <PlanCuentasClient cuentas={cuentas} />;
}