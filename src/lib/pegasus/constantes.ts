import type { TipoImportacionPegasus } from "@/generated/prisma/client";

export const NOMBRES_TIPO: Record<TipoImportacionPegasus, string> = {
  clientes: "Clientes",
  proveedores: "Proveedores",
  productos: "Productos",
  stock: "Stock",
  seriales: "Series / seriales",
};

export const CAMPOS_TIPO: Record<TipoImportacionPegasus, string> = {
  clientes: "codigo_pegasus;cedula;nombre;apellido;telefono;email;direccion;ciudad;ruc",
  proveedores: "codigo_pegasus;supplier;tax;phone;address;term",
  productos: "codigo;nombre;descripcion;costo;precio_base;stock_total;stock_minimo;barcode",
  stock: "codigo;stock_total;stock_minimo",
  seriales: "codigo;serial;deposito",
};

export const CLAVES_TIPO: Record<TipoImportacionPegasus, string[]> = {
  clientes: [
    "codigo_pegasus", "codigo", "cod", "cedula", "documento", "documento_identidad", "ci", "nro_documento",
    "nombre", "nombre_cliente", "nombre_del_cliente", "razon_social", "name", "nombres", "nombre_comercial", "cliente",
    "apellido", "apellidos", "telefono", "telefono_1", "phone", "movil", "celular", "tel",
    "email", "correo", "correo_electronico", "mail", "direccion", "address", "domicilio", "dir",
    "ciudad", "city", "ruc", "tax_id", "pais", "country", "tipo_documento",
    "tipo_cliente", "client_type", "cond_venta", "condicion_venta", "cod_vdor", "codigo_vendedor",
    "tipo_de_precio", "tipo_precio", "price_type", "zona", "zone", "act", "limite", "limite_credito",
  ],
  proveedores: [
    "codigo_pegasus", "codigo", "cod", "supplier", "nombre", "nombre_proveedor", "razon_social", "proveedor", "empresa",
    "tax", "ruc", "documento", "id_fiscal", "cuit", "phone", "telefono", "movil", "celular",
    "address", "direccion", "domicilio", "term", "plazo", "plazo_pago", "condicion_pago", "condicion", "document_type",
    "tip_doc", "vencim", "vencimiento", "acuer", "acuerdo", "aut",
  ],
  productos: [
    "codigo", "codigo_articulo", "cod_articulo", "codigo_de_articulo", "codigo_producto", "sku",
    "codigo_pegasus", "nombre", "descripcion", "descripcion_de_producto", "producto", "articulo",
    "costo", "costo_unitario", "costo_unit", "purchase_cost", "precio", "precio_base", "precio_venta", "pvp",
    "precio_unitario", "precio_unit", "stock", "stock_total", "cantidad", "existencia", "stock_minimo", "barcode",
    "codigo_barra", "codigo_de_barras", "categoria", "subcategoria", "uxb", "bultos",
  ],
  stock: [
    "codigo", "codigo_articulo", "cod_articulo", "codigo_de_articulo", "codigo_producto", "sku",
    "codigo_pegasus", "stock", "stock_total", "stock_actual", "stock_fisico", "cantidad",
    "existencia", "existencias", "unidades", "stock_minimo", "stock_min",
  ],
  seriales: [
    "codigo", "codigo_articulo", "cod_articulo", "sku", "codigo_pegasus",
    "serial", "serie", "numero_serie", "nro_serie", "imei", "deposito", "almacen",
  ],
};

/**
 * Detecta el tipo de importación a partir de las cabeceras reales del export de Pegasus
 * (misma lógica que `detectHeaders` de PROD QA). Devuelve null si no se reconoce.
 */
export type TipoPegasusDetectado = "clientes" | "proveedores" | "productos";

export function detectarTipoPegasus(headers: string[]): TipoPegasusDetectado | null {
  const h = headers.map((hd) =>
    hd.toLowerCase().trim().replace(/\s*\.\s*/g, ".").replace(/\s+/g, " "),
  );

  const hasCodigo = h.some(
    (x) => x.includes("cód") || x === "cod" || x.startsWith("cod.") || x === "código" || x === "codigo",
  );
  if (!hasCodigo) return null;

  const hasPrecio = h.some(
    (x) => x.includes("precio") || x.includes("p.venta") || x.includes("pventa") || x.includes("p venta") || x.includes("p.vta"),
  );
  const hasStock = h.some((x) => x.includes("stock") || x.includes("existencia") || x.includes("cantidad"));
  const hasDescripcionProducto = h.some(
    (x) => x.includes("descripción de producto") || x.includes("descripcion de producto"),
  );
  const hasCodigoBarra = h.some(
    (x) => x.includes("codigo barra") || x.includes("código barra") || x.includes("codigo de barras") || x.includes("código de barras") || x.includes("barcode"),
  );
  const hasCostoUnitario = h.some((x) => x.includes("costo unit") || x.includes("costo unitario"));

  // Export de stock valorizado Pegasus (Código, Descripción, Codigo Barra, Cantidad, Precio Unit., Costo Unit.)
  if (hasCodigo && hasDescripcionProducto && (hasCodigoBarra || hasPrecio || hasStock || hasCostoUnitario)) {
    return "productos";
  }

  // Productos: código + precio/stock, sin nombre cliente/proveedor, RUC o teléfono
  if (hasCodigo && (hasPrecio || hasStock)) {
    const hasNombreCliente = h.some((x) => x.includes("nombre cliente") || x === "cliente");
    const hasNombreProveedor = h.some((x) => x.includes("nombre proveedor") || x === "proveedor");
    const hasRuc = h.some((x) => x.includes("ruc") || x.includes("documento") || x.includes("cedula"));
    const hasTelefono = h.some((x) => x.includes("telefono") || x.includes("teléfono") || x.includes("tel."));
    if (!hasNombreCliente && !hasNombreProveedor && !hasRuc && !hasTelefono) return "productos";
  }

  const hasNombre = h.some((x) => x === "nombre" || x.startsWith("nombre"));
  const hasNombreCliente = h.some((x) => x.includes("nombre cliente") || x === "cliente");
  const hasNombreProveedor = h.some((x) => x.includes("nombre proveedor") || x === "proveedor");

  if (hasNombreCliente) return "clientes";
  if (hasNombreProveedor) return "proveedores";

  const hasTipoCliente =
    h.some((x) => x.includes("tipo") || x.includes("cond.venta") || x.includes("cond venta") || x.includes("límite") || x.includes("limite credito") || x.includes("vdor"));
  const hasPlazo = h.some((x) => x.includes("plazo"));
  const hasVencim = h.some((x) => x.includes("vencim"));
  const hasCondicionPago = h.some((x) => x.includes("condición") || x.includes("condicion"));

  if (hasNombre) {
    if (hasTipoCliente && !hasPlazo && !hasVencim) return "clientes";
    if (hasPlazo || hasVencim) return "proveedores";
  }

  if (hasCondicionPago && hasNombre) {
    if (h.some((x) => x.includes("teléfono") || x.includes("telefono") || x.includes("ruc"))) return "clientes";
  }

  return null;
}
