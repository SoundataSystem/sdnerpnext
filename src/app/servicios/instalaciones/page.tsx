import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getInstalaciones,
  getOrdenesServicio,
  getTecnicos,
} from "@/lib/servicios/repository";
import { InstalacionesClient } from "@/components/servicios/instalaciones-client";

export const metadata: Metadata = {
  title: "Instalaciones",
};

export default async function InstalacionesPage() {
  await getRoleOrRedirect("admin", "vendedor", "servicio_tecnico", "supervisor_tecnico");
  const [instalaciones, tecnicos, ordenes] = await Promise.all([
    getInstalaciones(),
    getTecnicos(),
    getOrdenesServicio(),
  ]);

  return (
    <InstalacionesClient
      instalaciones={instalaciones}
      tecnicos={tecnicos}
      ordenes={ordenes}
    />
  );
}
