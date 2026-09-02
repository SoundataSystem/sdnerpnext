import { NextRequest, NextResponse } from "next/server";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getCajaMovimientosPage } from "@/lib/ventas/repository";

export async function GET(request: NextRequest) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  
  const { searchParams } = new URL(request.url);
  const busqueda = searchParams.get("q") || undefined;
  const estado = searchParams.get("estado") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20),
  );

  try {
    const result = await getCajaMovimientosPage({
      page,
      pageSize,
      busqueda,
      estado: estado === "todos" ? undefined : estado,
    });
    
    return NextResponse.json({
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    });
  } catch (error) {
    console.error("Error searching caja:", error);
    return NextResponse.json({ error: "Error al buscar caja" }, { status: 500 });
  }
}