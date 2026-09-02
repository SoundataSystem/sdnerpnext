import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getActividad,
  getLogsAuditoria,
} from "@/lib/auditoria/repository";
import { AuditoriaClient } from "@/components/auditoria/auditoria-client";

export const metadata: Metadata = {
  title: "Auditoría",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await getRoleOrRedirect("admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [actividad, logs] = await Promise.all([
    getActividad(page),
    getLogsAuditoria(page),
  ]);

  return <AuditoriaClient actividad={actividad} logs={logs} />;
}
