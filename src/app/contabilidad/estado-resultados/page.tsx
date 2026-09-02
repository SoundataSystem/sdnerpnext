import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getAsientos, getCuentas } from "@/lib/contabilidad/repository";
import { EstadoResultadosClient } from "@/components/contabilidad/estado-resultados-client";

export const metadata: Metadata = {
  title: "Estado de Resultados",
};

export default async function EstadoResultadosPage() {
  await getRoleOrRedirect("admin", "contabilidad");
  const [asientos, cuentas] = await Promise.all([getAsientos(), getCuentas()]);

  return <EstadoResultadosClient asientos={asientos} cuentas={cuentas} />;
}