// Validación: los 3 exports de Pegasus (clientes/proveedores/stock valorizado) deben
// interpretarse directamente por el pipeline nuevo sin cambios en los archivos.
// Reproduce el flujo del cliente: XLSX → CSV ";" → detectarCabecera → detectarTipoPegasus
// → mapeo fuzzy de columnas (misma lógica que PROD QA).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import {
  parseCSV,
  normalizarEncabezado,
  detectarCabecera,
  valorDe,
} from "../src/lib/pegasus/parser";
import { CLAVES_TIPO, detectarTipoPegasus } from "../src/lib/pegasus/constantes";
import {
  parsearNombreApellido,
  limpiarTelefono,
  parsearRUC,
  mapearPlazoPago,
  parsearFechaPegasus,
} from "../src/lib/pegasus/pegasus-utils";

const dir = "C:/Users/Corporacion Capsula/Desktop/pegasus";
const archivos = ["clientes.xlsx", "proveedores.xlsx", "stock.xlsx"];

// Mismos arrays de aliases que importer.ts (para verificar el mapeo de campos).
const ALIASES_CLIENTES = {
  codigoPegasus: ["codigo_pegasus", "codigo", "cod", "id_cliente", "code", "codigo_cliente", "cod_cliente"],
  nombre: ["nombre", "nombre_cliente", "nombre_del_cliente", "cliente", "razon_social", "name", "nombres", "nombre_comercial"],
  telefono: ["telefono", "telefono_1", "phone", "movil", "celular", "tel"],
  ruc: ["ruc", "tax_id", "id_fiscal", "documento", "doc"],
  direccion: ["direccion", "address", "domicilio", "dir"],
  cond_venta: ["cond_venta", "condicion_venta", "condicion_venta_pegasus"],
};
const ALIASES_PROVEEDORES = {
  codigoPegasus: ["codigo_pegasus", "codigo", "cod", "id_proveedor", "code", "código"],
  supplier: ["supplier", "nombre_proveedor", "proveedor", "razon_social", "raz_social", "nombre", "empresa", "name"],
  tax: ["tax", "ruc", "documento", "id_fiscal", "ruc_dni", "cuit"],
  phone: ["phone", "telefono", "movil", "celular"],
  tip_doc: ["tipo_documento_pegasus", "tip_doc", "document_type", "tipo_documento", "tipo_doc"],
  condicion: ["condition_description", "condicion", "condicion_pago", "cond"],
  plazo: ["term", "plazo", "plazo_pago", "condicion_pago"],
  vencim: ["vencimiento", "vencim", "venc", "fecha_vencimiento_autorizacion"],
  acuer: ["acuerdo", "acuer"],
};
const ALIASES_PRODUCTOS = {
  codigo: ["codigo", "codigo_articulo", "cod_articulo", "codigo_de_articulo", "codigo_producto", "cod_producto", "cod", "code", "sku", "no", "no_articulo", "cod_art", "referencia", "ref", "id_articulo", "codigo_art"],
  nombre: ["nombre", "nombre_producto", "descripcion", "descripcion_de_producto", "descripcion_breve", "descripcion_corta", "producto", "articulo", "detalle", "name"],
  precio: ["precio", "precio_unit", "precio_unitario", "precio_base", "precio_venta", "precio_de_venta", "precio_publico", "pvp", "venta", "precio_lista", "lista"],
  costo: ["costo", "costo_unit", "costo_unitario", "purchase_cost", "precio_costo", "costo_importacion", "costo_de_importacion", "costo_promedio", "costo_medio", "costo_promedio_ponderado", "c_unitario"],
  barcode: ["barcode", "codigo_barra", "codigo_de_barras", "bar_code", "sku", "ean"],
  stock: ["stock", "stock_total", "existencia", "existencias", "cantidad", "unidades"],
};

for (const archivo of archivos) {
  const ruta = join(dir, archivo);
  const wb = XLSX.read(readFileSync(ruta), { type: "buffer" });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(hoja, { FS: ";", blankrows: false });
  const filas = parseCSV(csv);
  const claves = new Set(Object.values(CLAVES_TIPO).flat());
  const idxCab = detectarCabecera(filas, claves);
  if (idxCab < 0) {
    console.log(`=== ${archivo} ===\n  ❌ No se detectó la fila de cabecera`);
    continue;
  }
  const headers = filas[idxCab].map(normalizarEncabezado);
  const tipo = detectarTipoPegasus(filas[idxCab]);
  const dataRows = filas.slice(idxCab + 1).filter((r) => r.some((c) => c.trim() !== ""));
  const aObjetos: Record<string, string>[] = dataRows.map((celdas) => {
    const datos: Record<string, string> = {};
    headers.forEach((h, j) => {
      if (h) datos[h] = celdas[j] ?? "";
    });
    return datos;
  });
  console.log(`=== ${archivo} ===`);
  console.log(`  cabecera fila #${idxCab + 1}: ${filas[idxCab].filter(Boolean).slice(0, 12).join(" | ")}`);
  console.log(`  tipo detectado: ${tipo ?? "— (manual)"}`);
  console.log(`  filas de datos: ${dataRows.length}`);

  const muestras = aObjetos.slice(0, 3);
  if (tipo === "clientes") {
    for (const m of muestras) {
      const nombreCompleto = valorDe(m, ALIASES_CLIENTES.nombre) ?? "";
      const { nombre, apellido } = parsearNombreApellido(nombreCompleto);
      const ruc = parsearRUC(valorDe(m, ALIASES_CLIENTES.ruc) ?? "");
      console.log(`  · ${valorDe(m, ALIASES_CLIENTES.codigoPegasus)} | ${nombre} ${apellido} | RUC/CI: ${ruc.ruc ?? ruc.cedula ?? ""} | tel: ${limpiarTelefono(valorDe(m, ALIASES_CLIENTES.telefono) ?? "") ?? ""}`);
    }
    const sinCodigo = aObjetos.filter((m) => !valorDe(m, ALIASES_CLIENTES.codigoPegasus)).length;
    const sinNombre = aObjetos.filter((m) => !valorDe(m, ALIASES_CLIENTES.nombre)).length;
    console.log(`  ✅ mapeo: ${aObjetos.length} filas, ${sinCodigo} sin código, ${sinNombre} sin nombre`);
  } else if (tipo === "proveedores") {
    for (const m of muestras) {
      const supplier = valorDe(m, ALIASES_PROVEEDORES.supplier) ?? "";
      const razon = supplier.replace(/\(.+?\)/, "").trim();
      console.log(`  · ${valorDe(m, ALIASES_PROVEEDORES.codigoPegasus)} | ${razon} | tax: ${razon && valorDe(m, ALIASES_PROVEEDORES.tax)} | plazo: ${mapearPlazoPago(valorDe(m, ALIASES_PROVEEDORES.plazo) ?? "")} | vto: ${parsearFechaPegasus(valorDe(m, ALIASES_PROVEEDORES.vencim) ?? "")?.toISOString().split("T")[0] ?? ""}`);
    }
    const sinSupplier = aObjetos.filter((m) => !valorDe(m, ALIASES_PROVEEDORES.supplier)).length;
    const sinCodigo = aObjetos.filter((m) => !valorDe(m, ALIASES_PROVEEDORES.codigoPegasus)).length;
    console.log(`  ✅ mapeo: ${aObjetos.length} filas, ${sinSupplier} sin supplier, ${sinCodigo} sin código`);
  } else if (tipo === "productos") {
    for (const m of muestras) {
      console.log(`  · ${valorDe(m, ALIASES_PRODUCTOS.codigo)} | ${(valorDe(m, ALIASES_PRODUCTOS.nombre) ?? "").slice(0, 40)} | costo: ${valorDe(m, ALIASES_PRODUCTOS.costo)} | precio: ${valorDe(m, ALIASES_PRODUCTOS.precio)} | stock: ${valorDe(m, ALIASES_PRODUCTOS.stock)} | barra: ${valorDe(m, ALIASES_PRODUCTOS.barcode)}`);
    }
    const sinNombre = aObjetos.filter((m) => !valorDe(m, ALIASES_PRODUCTOS.nombre)).length;
    const sinCodigo = aObjetos.filter((m) => !valorDe(m, ALIASES_PRODUCTOS.codigo)).length;
    const sinStock = aObjetos.filter((m) => valorDe(m, ALIASES_PRODUCTOS.stock) === null).length;
    console.log(`  ✅ mapeo: ${aObjetos.length} filas, ${sinNombre} sin nombre, ${sinCodigo} sin código, ${sinStock} sin stock`);
  } else {
    console.log(`  ⚠️  tipo no detectado automáticamente — se usaría el selector manual`);
  }
}