import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getImportaciones } from "@/lib/pegasus/repository";
import { PegasusClient } from "@/components/pegasus/pegasus-client";

export const metadata: Metadata = {
  title: "Importación Pegasus",
};

export default async function PegasusPage() {
  await getRoleOrRedirect("admin");
  const { importaciones } = await getImportaciones(50);
  return <PegasusClient importaciones={importaciones} />;
}
