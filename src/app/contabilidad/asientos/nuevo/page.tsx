import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getCuentas } from "@/lib/contabilidad/repository";
import { AsientoFormClient } from "@/components/contabilidad/asiento-form-client";

export const metadata: Metadata = {
  title: "Nuevo Asiento",
};

export default async function NuevoAsientoPage() {
  await getRoleOrRedirect("admin", "contabilidad");
  const cuentas = await getCuentas();

  return <AsientoFormClient cuentas={cuentas} />;
}