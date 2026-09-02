import { describe, it, expect } from "vitest";
import {
  filasAObjetos,
  normalizarEncabezado,
  parseCSV,
  detectarCabecera,
  valorDe,
  num,
  esFilaResumen,
} from "./parser";

describe("normalizarEncabezado", () => {
  it("normaliza minúsculas, espacios y acentos", () => {
    expect(normalizarEncabezado("Código Pegasus")).toBe("codigo_pegasus");
    expect(normalizarEncabezado("Nombre")).toBe("nombre");
    expect(normalizarEncabezado("R.U.C.")).toBe("r_u_c");
  });
});

describe("parseCSV", () => {
  it("separa filas y columnas con ;", () => {
    expect(parseCSV("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ignora líneas vacías", () => {
    expect(parseCSV("a;b\n\n1;2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("filasAObjetos", () => {
  const texto = "cedula;nombre;apellido\n123;Juan;Perez\n456;Ana;Gomez";
  const filas = filasAObjetos(texto);

  it("toma la primera fila como encabezado", () => {
    expect(filas).toHaveLength(2);
    expect(filas[0].datos.nombre).toBe("Juan");
    expect(filas[1].datos.apellido).toBe("Gomez");
  });

  it("el número de fila es 1-indexado con encabezado", () => {
    expect(filas[0].fila).toBe(2);
  });

  it("descarta filas totalmente vacías", () => {
    expect(filasAObjetos("a;b\n\n\nx;y")).toHaveLength(1);
  });
});

describe("detectarCabecera", () => {
  const claves = new Set(["codigo", "descripcion", "cantidad", "costo", "stock"]);

  it("encuentra la fila de encabezados por coincidencia de claves", () => {
    const filas = [
      ["soundata_s_a"],
      [],
      ["CÓDIGO", "DESCRIPCIÓN", "CANTIDAD", "COSTO"],
      ["A1", "ARTICULO 1", "10", "5.50"],
      ["A2", "ARTICULO 2", "20", "6.00"],
    ];
    expect(detectarCabecera(filas, claves)).toBe(2);
  });

  it("ignora líneas de título sin claves conocidas", () => {
    const filas = [
      ["soundata_s_a", "", "fecha", "27_05_2026_14_37"],
      ["COD", "PRODUCTO", "QTY", "PRECIO"],
      ["1", "X", "2", "3"],
    ];
    // "producto" y "precio" no están en las claves de este test
    expect(detectarCabecera(filas, claves)).toBe(-1);
  });

  it("devuelve -1 si no hay claves conocidas", () => {
    expect(detectarCabecera([["a", "b"]], claves)).toBe(-1);
  });
});

describe("filasAObjetos con fila de encabezado explícita", () => {
  it("ignora filas previas de título y usa la fila indicada", () => {
    const texto = "soundata_s_a\nCÓDIGO;DESCRIPCIÓN;CANTIDAD\nA1;X;10\nA2;Y;20";
    const filas = filasAObjetos(texto, 1);
    expect(filas).toHaveLength(2);
    expect(filas[0].datos.codigo).toBe("A1");
    expect(filas[1].datos.cantidad).toBe("20");
  });
});

describe("valorDe", () => {
  it("devuelve el primer valor presente", () => {
    expect(
      valorDe({ codigo: "c1", codigo_pegasus: "" }, ["codigo_pegasus", "codigo"]),
    ).toBe("c1");
  });

  it("devuelve null si no hay valor", () => {
    expect(valorDe({}, ["codigo"])).toBeNull();
  });
});

describe("num", () => {
  it("parsea números con separadores", () => {
    expect(num("1.500,50")).toBe(1500.5);
    expect(num("123")).toBe(123);
  });

  it("devuelve null para valores vacíos", () => {
    expect(num("")).toBeNull();
    expect(num(null)).toBeNull();
  });
});

describe("esFilaResumen", () => {
  it("detecta el bloque de resumen que Pegasus agrega al pie del export", () => {
    expect(
      esFilaResumen({ codigo: "", nombre: "", c2: "Total de Clientes:", c5: "44,657" }),
    ).toBe(true);
    expect(esFilaResumen({ c2: "Líneas", c5: "44,306" })).toBe(true);
    expect(esFilaResumen({ c0: "", c2: "Categoría :", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c0: "", c2: "Estado:", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c2: "Vendedor :", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c2: "Zona :", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c1: "Tipo Cliente:", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c1: "Ciudad:", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c0: "Fecha Alta >= a" })).toBe(true);
  });

  it("detecta el bloque de resumen del export de stock (filtros del reporte)", () => {
    expect(esFilaResumen({ c0: "", c2: "Filtros Establecidos:" })).toBe(true);
    expect(esFilaResumen({ c2: "Producto:" })).toBe(true);
    expect(esFilaResumen({ c2: "Sección:", c5: "Todas" })).toBe(true);
    expect(esFilaResumen({ c2: "Sub Sección:", c5: "Todas" })).toBe(true);
    expect(esFilaResumen({ c2: "Grupo:", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c2: "Sub Categoría:", c5: "Todas" })).toBe(true);
    expect(esFilaResumen({ c2: "Marca:", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c2: "Depositos:", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c2: "Fecha:", c5: "27/05/2026" })).toBe(true);
    expect(esFilaResumen({ c2: "Pais:", c5: "PARAGUAY" })).toBe(true);
    expect(esFilaResumen({ c2: "Iva:", c5: "Todos" })).toBe(true);
    expect(esFilaResumen({ c2: "Proveedor:", c5: "Todos" })).toBe(true);
  });

  it("no descarta una fila de datos real de stock (código + cantidad)", () => {
    expect(
      esFilaResumen({ codigo: "36366", nombre: "RACK NINGBO TURN-LINK", c8: "620", c11: "1,500" }),
    ).toBe(false);
    expect(
      esFilaResumen({ codigo: "36367", nombre: "ACCESORIOS PARA RACK NINGBO TURN-LINK", c8: "620", c11: "1,500" }),
    ).toBe(false);
  });

  it("no descarta filas de datos reales (más de 2 celdas pobladas o texto de cliente)", () => {
    expect(
      esFilaResumen({ codigo: "2067765142", nombre: "ALEJANDRO MEDINA", c5: "ASUNCION", c8: "0982 225589" }),
    ).toBe(false);
    expect(esFilaResumen({ codigo: "1", nombre: "AUDIO 3C", ruc: "800491203" })).toBe(false);
  });
});

describe("filasAObjetos descarta el bloque de resumen", () => {
  it("excluye las filas finales de totales/filtros de Pegasus", () => {
    const texto = [
      "codigo;nombre;ciudad",
      "1;AUDIO 3C;ASUNCION",
      "2;SOUNDATA S.A;ASUNCION",
      ";;Total de Clientes: ;44,657",
      ";;Líneas;44,306",
      ";;Categoría :;Todos",
    ].join("\n");
    const filas = filasAObjetos(texto);
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.datos.codigo)).toEqual(["1", "2"]);
  });
});
