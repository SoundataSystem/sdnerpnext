import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { filasAObjetos, parseCSV, detectarCabecera } from "../src/lib/pegasus/parser";
import { CLAVES_TIPO } from "../src/lib/pegasus/constantes";
const ruta = "C:/Users/Corporacion Capsula/Desktop/pegasus/stock.xlsx";
const wb = XLSX.read(readFileSync(ruta), { type: "buffer" });
const hoja = wb.Sheets[wb.SheetNames[0]];
const csv = XLSX.utils.sheet_to_csv(hoja, { FS: ";", blankrows: false });
const raw = parseCSV(csv);
const idx = detectarCabecera(raw, new Set(CLAVES_TIPO.productos));
console.log("cabecera fila:", idx + 1, "| headers:", raw[idx].slice(0, 12).join(" | "));
const filas = filasAObjetos(csv, idx);
console.log("total filas:", filas.length);
console.log("headers normalizados:", raw[idx].map((h) => h.trim()).join(" | "));
// filas sin nombre (descripción)
const sinNombre = filas.filter((f) => {
  const n = f.datos["descripcion_de_producto"] ?? f.datos["nombre"] ?? "";
  return !n.trim();
});
console.log("filas sin nombre:", sinNombre.length);
for (const f of sinNombre.slice(0, 20)) {
  console.log(" fila", f.fila, JSON.stringify(Object.values(f.datos).slice(0, 8).join("|")));
}