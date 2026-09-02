import { NextRequest, NextResponse } from "next/server";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getProductosInventarioPage } from "@/lib/inventario/repository";

export async function GET(request: NextRequest) {
  await getRoleOrRedirect("admin", "deposito", "administracion", "logistica");
  
  const { searchParams } = new URL(request.url);
  const busqueda = searchParams.get("q") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20),
  );

  try {
    const result = await getProductosInventarioPage({
      page,
      pageSize,
      busqueda,
    });
    
    return NextResponse.json({
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    });
  } catch (error) {
    console.error("Error searching productos:", error);
    return NextResponse.json({ error: "Error al buscar productos" }, { status: 500 });
  }
}