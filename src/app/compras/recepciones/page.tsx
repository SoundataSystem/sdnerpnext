import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOcsFlujoActivo, getDepositos } from "@/lib/compras/repository";
import { RecepcionesClient } from "@/components/compras/recepciones-client";

export const metadata: Metadata = {
  title: "Recepciones",
};

export default async function RecepcionesPage() {
  await getRoleOrRedirect("admin", "compra", "administracion", "recepcion_compras");
  const [ocs, depositos] = await Promise.all([
    getOcsFlujoActivo(),
    getDepositos(),
  ]);

  return <RecepcionesClient ocs={ocs} depositos={depositos} />;
}