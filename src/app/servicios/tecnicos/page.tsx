import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getTecnicos } from "@/lib/servicios/repository";
import { TecnicosClient } from "@/components/servicios/tecnicos-client";

export const metadata: Metadata = {
  title: "Técnicos",
};

export default async function TecnicosPage() {
  await getRoleOrRedirect("admin", "vendedor", "servicio_tecnico", "supervisor_tecnico");
  const tecnicos = await getTecnicos();

  return <TecnicosClient tecnicos={tecnicos} />;
}
