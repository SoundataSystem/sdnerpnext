import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getUsuarios } from "@/lib/usuarios/repository";
import { UsuariosClient } from "@/components/usuarios/usuarios-client";

export const metadata: Metadata = {
  title: "Usuarios",
};

export default async function UsuariosPage() {
  await getRoleOrRedirect("admin");
  const usuarios = await getUsuarios();

  return <UsuariosClient usuarios={usuarios} />;
}
