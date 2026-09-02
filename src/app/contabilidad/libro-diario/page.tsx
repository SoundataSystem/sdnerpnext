import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getAsientos, getCuentas } from "@/lib/contabilidad/repository";
import { LibroDiarioClient } from "@/components/contabilidad/libro-diario-client";

export const metadata: Metadata = {
  title: "Libro Diario",
};

export default async function LibroDiarioPage() {
  await getRoleOrRedirect("admin", "contabilidad");
  const [asientos, cuentas] = await Promise.all([getAsientos(), getCuentas()]);

  return <LibroDiarioClient asientos={asientos} cuentas={cuentas} />;
}