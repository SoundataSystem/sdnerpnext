import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import {
  getAjustesStock,
  getDepositosInventario,
  getProductosInventario,
} from "@/lib/inventario/repository";
import { AjustesClient } from "@/components/inventario/ajustes-client";

export const metadata: Metadata = {
  title: "Ajustes de Stock",
};

export default async function AjustesPage() {
  const user = await getRoleOrRedirect("admin", "deposito", "administracion", "logistica");
  const [ajustes, depositos, productos] = await Promise.all([
    getAjustesStock(),
    getDepositosInventario(),
    getProductosInventario(),
  ]);

  const puedeAprobar = Boolean(
    user && ["admin", "administracion", "logistica"].includes(user.rol),
  );

  return (
    <AjustesClient
      ajustes={ajustes}
      depositos={depositos}
      productos={productos}
      puedeAprobar={puedeAprobar}
    />
  );
}