import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getConfiguracion, getMetodosPagoConfig } from "@/lib/configuracion/repository";
import { getDepositosInventario } from "@/lib/inventario/repository";
import { ConfiguracionClient } from "@/components/configuracion/configuracion-tabs-client";

export const metadata: Metadata = {
  title: "Configuración",
};

export default async function ConfiguracionPage() {
  await getRoleOrRedirect("admin");
  const [config, metodos, depositos] = await Promise.all([
    getConfiguracion(),
    getMetodosPagoConfig(),
    getDepositosInventario(),
  ]);

  return (
    <ConfiguracionClient
      config={config}
      metodos={metodos}
      depositos={depositos}
    />
  );
}