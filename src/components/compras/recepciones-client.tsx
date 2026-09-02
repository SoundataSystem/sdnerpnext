"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  PackageCheck,
  Warehouse,
  Truck,
  ArrowDownToLine,
  Barcode,
  Camera,
  Split,
  Upload,
} from "lucide-react";
import {
  registrarRecepcionAction,
  ingresarStockAction,
  crearProductoCompraAction,
  buscarProductoPorBarcodeAction,
  sugerirCodigoProductoAction,
} from "@/lib/actions/compras-actions";
import { createClient } from "@/lib/supabase/client";
import { formatGs } from "@/lib/compras/calculos";
import type { OcDTO, DepositoDTO } from "@/lib/compras/repository";

interface LineaRecepcion {
  oc_item_id: string;
  producto_id: string;
  producto_nombre: string;
  producto_codigo: string;
  barcode: string;
  descripcion: string;
  precio_venta: number;
  cantidad_solicitada: number;
  cantidad_recibida: number;
  serial: string;
  observaciones: string;
  fotos: string[];
}

const lineaVaciaDesde = (
  ocItemId: string,
  data: Partial<LineaRecepcion> = {},
): LineaRecepcion => ({
  oc_item_id: ocItemId,
  producto_id: "",
  producto_nombre: "",
  producto_codigo: "",
  barcode: "",
  descripcion: "",
  precio_venta: 0,
  cantidad_solicitada: 1,
  cantidad_recibida: 1,
  serial: "",
  observaciones: "",
  fotos: [],
  ...data,
});

export function RecepcionesClient({
  ocs,
  depositos,
}: {
  ocs: OcDTO[];
  depositos: DepositoDTO[];
}) {
  const [recepcionOc, setRecepcionOc] = useState<OcDTO | null>(null);
  const [factura_numero, setFacturaNumero] = useState("");
  const [factura_fecha, setFacturaFecha] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [factura_monto, setFacturaMonto] = useState(0);
  const [factura_archivo, setFacturaArchivo] = useState<File | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaRecepcion[]>([]);

  const [ingresoOc, setIngresoOc] = useState<OcDTO | null>(null);
  const [deposito_id, setDepositoId] = useState("");

  // Creación de producto sobre la marcha (idx = línea destino o null si es
  // una creación independiente desde el encabezado).
  const [creandoProdCtx, setCreandoProdCtx] = useState<{
    idx: number | null;
    nombre: string;
    codigo: string;
    barcode: string;
    descripcion: string;
    precioVenta: number;
    costo: number;
  } | null>(null);

  // Cámara
  const [camaraIdx, setCamaraIdx] = useState<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const serialRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Refs para acceder a estado actual dentro de callbacks de useAction.
  const barcodeIdxRef = useRef(-1);
  const barcodeValRef = useRef("");
  const creandoProdCtxRef = useRef(creandoProdCtx);
  useEffect(() => {
    creandoProdCtxRef.current = creandoProdCtx;
  }, [creandoProdCtx]);

  const recibir = useAction(registrarRecepcionAction, {
    onSuccess: () => {
      toast.success("Recepción registrada");
      cerrarModalRecepcion();
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al registrar recepción"),
  });

  const ingresar = useAction(ingresarStockAction, {
    onSuccess: () => {
      toast.success("Mercadería ingresada a stock");
      setIngresoOc(null);
      setDepositoId("");
    },
    onError: (err) => toast.error(err.error.serverError ?? "Error al ingresar"),
  });

  const crearProd = useAction(crearProductoCompraAction, {
    onSuccess: (res) => {
      const ctx = creandoProdCtxRef.current;
      const id = res.data?.id;
      if (!id || !ctx) return;
      if (ctx.idx !== null && recepcionOc) {
        actualizarLinea(ctx.idx, {
          producto_id: id,
          producto_nombre: ctx.nombre.trim(),
          producto_codigo: ctx.codigo.trim(),
          precio_venta: Number(ctx.precioVenta) || 0,
        });
      }
      toast.success(`Producto "${ctx.nombre.trim()}" creado`);
      setCreandoProdCtx(null);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al crear producto"),
  });

  const buscarBarcode = useAction(buscarProductoPorBarcodeAction, {
    onSuccess: (res) => {
      const idx = barcodeIdxRef.current;
      if (idx < 0 || !recepcionOc) return;
      const p = res.data;
      if (p) {
        actualizarLinea(idx, {
          producto_id: p.id,
          producto_nombre: p.nombre,
          producto_codigo: p.codigo,
          descripcion: p.descripcion,
          precio_venta: p.precio_base,
        });
        toast.success(`Producto "${p.nombre}" asignado`);
      } else {
        sugerirCodigo.execute();
      }
    },
    onError: (err) =>
      toast.error(
        err.error.serverError ?? "Error al buscar el código escaneado",
      ),
  });

  const sugerirCodigo = useAction(sugerirCodigoProductoAction, {
    onSuccess: (res) => {
      const idx = barcodeIdxRef.current;
      if (idx < 0) return;
      setCreandoProdCtx({
        idx,
        nombre: "",
        codigo: res.data?.codigo ?? "",
        barcode: barcodeValRef.current,
        descripcion: "",
        precioVenta: 0,
        costo: 0,
      });
    },
  });

  const pendientesRecepcion = ocs.filter(
    (o) => o.estado === "enviada" || o.estado === "recepcion_parcial",
  );
  const pendientesIngreso = ocs.filter(
    (o) => o.estado === "pendiente_ingreso_stock",
  );

  // ─── Apertura de recepción: desglose automático en unidades ───────────────

  const abrirRecepcion = (oc: OcDTO) => {
    setRecepcionOc(oc);
    setFacturaNumero("");
    setFacturaFecha(new Date().toISOString().split("T")[0]);
    setFacturaMonto(0);
    setFacturaArchivo(null);
    setObservaciones("");
    const nuevas: LineaRecepcion[] = [];
    for (const it of oc.items) {
      const pendiente = Math.max(0, it.cantidad - it.cantidad_recibida);
      const base: Partial<LineaRecepcion> = {
        producto_id: it.producto_id,
        producto_nombre: it.producto_nombre,
        producto_codigo: it.producto_codigo ?? "",
        cantidad_solicitada: pendiente,
        cantidad_recibida: pendiente,
      };
      // Desglosar en líneas de 1 unidad para registrar un serial por unidad.
      if (pendiente > 1) {
        for (let i = 0; i < pendiente; i++) {
          nuevas.push(lineaVaciaDesde(it.item_id, base));
        }
      } else {
        nuevas.push(lineaVaciaDesde(it.item_id, base));
      }
    }
    setLineas(nuevas);
    // Foco inicial en el primer serial, como en el proyecto React.
    setTimeout(() => serialRefs.current[0]?.focus(), 50);
  };

  const cerrarModalRecepcion = () => {
    setRecepcionOc(null);
    setLineas([]);
    setFacturaNumero("");
    setFacturaMonto(0);
    setObservaciones("");
    setFacturaArchivo(null);
  };

  // ─── Edición de líneas ────────────────────────────────────────────────────

  const actualizarLinea = (idx: number, cambios: Partial<LineaRecepcion>) =>
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)),
    );

  const avanzarSerial = (idx: number) => {
    const next = idx + 1;
    if (next < lineas.length && serialRefs.current[next]) {
      serialRefs.current[next]?.focus();
    }
  };

  const desglosarSeriales = (idx: number) => {
    const linea = lineas[idx];
    if (!linea || linea.cantidad_recibida <= 1) {
      toast.info("La cantidad debe ser mayor a 1 para desglosar");
      return;
    }
    const nuevas: LineaRecepcion[] = [];
    for (let i = 0; i < linea.cantidad_recibida; i++) {
      nuevas.push({
        ...linea,
        cantidad_solicitada: 1,
        cantidad_recibida: 1,
        serial: "",
        fotos: [],
      });
    }
    setLineas((prev) => [
      ...prev.slice(0, idx),
      ...nuevas,
      ...prev.slice(idx + 1),
    ]);
    toast.success(`Desglosado en ${linea.cantidad_recibida} unidades`);
  };

  // ─── Escaneo libre de barcode ─────────────────────────────────────────────

  const resolverBarcode = (idx: number, barcode: string) => {
    const limpio = barcode.trim();
    if (!limpio) return;
    actualizarLinea(idx, { barcode: limpio });
    barcodeIdxRef.current = idx;
    barcodeValRef.current = limpio;
    buscarBarcode.execute({ barcode: limpio });
  };

  const confirmarCrearProducto = () => {
    const ctx = creandoProdCtx;
    if (!ctx) return;
    if (!ctx.nombre.trim()) {
      toast.warning("El nombre del producto es obligatorio");
      return;
    }
    crearProd.execute({
      nombre: ctx.nombre.trim(),
      codigo: ctx.codigo.trim() || undefined,
      barcode: ctx.barcode.trim() || undefined,
      descripcion: ctx.descripcion.trim() || undefined,
      precio_base: Number(ctx.precioVenta) || 0,
      purchase_cost: Number(ctx.costo) || 0,
    });
  };

  // ─── Fotos: cámara y archivos (bucket productos, fallback facturas) ──────

  const subirBlobComoFoto = async (
    blob: Blob,
    productoId: string,
    contentType: string,
  ): Promise<string | null> => {
    const supabase = createClient();
    const ext = contentType === "image/jpeg" ? "jpg" : "img";
    const fileName = `${productoId}-${Date.now()}.${ext}`;
    const path = `productos/${productoId}/${fileName}`;
    let bucket = "productos";
    let error = (
      await supabase.storage.from(bucket).upload(path, blob, {
        contentType,
        upsert: true,
      })
    ).error;
    if (error) {
      bucket = "facturas-proveedores";
      error = (
        await supabase.storage.from(bucket).upload(path, blob, {
          contentType,
          upsert: true,
        })
      ).error;
    }
    if (error) {
      toast.error(`Error al subir foto: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const agregarFotoALineas = (idx: number, url: string) => {
    const origen = lineas[idx];
    setLineas((prev) =>
      prev.map((l, i) =>
        i === idx
          ? { ...l, fotos: [...l.fotos, url] }
          : origen.producto_id && l.producto_id === origen.producto_id
            ? l.fotos.includes(url)
              ? l
              : { ...l, fotos: [...l.fotos, url] }
            : l,
      ),
    );
  };

  const subirFotoDesdeArchivo = async (idx: number, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    const productoId = lineas[idx]?.producto_id || "sin-id";
    const url = await subirBlobComoFoto(
      file,
      productoId,
      file.type || "image/jpeg",
    );
    if (!url) return;
    agregarFotoALineas(idx, url);
    toast.success("Foto subida");
  };

  const abrirCamara = async (idx: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCamaraIdx(idx);
    } catch {
      toast.error("No se pudo acceder a la cámara. Verificá los permisos.");
    }
  };

  useEffect(() => {
    if (camaraIdx !== null && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [camaraIdx]);

  const capturarFoto = () => {
    if (camaraIdx === null || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Error al inicializar canvas");
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          toast.error("Error al generar imagen desde la cámara");
          return;
        }
        const idx = camaraIdx;
        const productoId = lineas[idx]?.producto_id || "sin-id";
        const url = await subirBlobComoFoto(blob, productoId, "image/jpeg");
        if (!url) return;
        agregarFotoALineas(idx, url);
        toast.success("Foto capturada");
        cerrarCamara();
      },
      "image/jpeg",
      0.8,
    );
  };

  const cerrarCamara = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamaraIdx(null);
  };

  const aplicarATodos = (idx: number) => {
    const origen = lineas[idx];
    if (!origen.producto_id) return;
    setLineas((prev) =>
      prev.map((l, i) =>
        i !== idx && l.producto_id === origen.producto_id
          ? {
              ...l,
              producto_nombre: origen.producto_nombre,
              descripcion: origen.descripcion,
              fotos: [...origen.fotos],
            }
          : l,
      ),
    );
    toast.success("Nombre, descripción y fotos aplicados al mismo producto");
  };

  // ─── Guardar recepción ────────────────────────────────────────────────────

  const registrar = async () => {
    if (!recepcionOc) return;
    const conCantidad = lineas.filter((l) => l.cantidad_recibida > 0);
    if (conCantidad.length === 0) {
      toast.warning("Indica al menos un ítem con cantidad recibida");
      return;
    }
    for (const l of conCantidad) {
      if (!l.producto_id) {
        toast.error(
          "Hay ítems sin producto asignado. Escaneá el barcode o creá el producto.",
        );
        return;
      }
      if (l.cantidad_recibida > l.cantidad_solicitada) {
        toast.info(
          `"${l.producto_nombre}": excedente ${l.cantidad_recibida - l.cantidad_solicitada} sobre lo solicitado (${l.cantidad_solicitada}) - se registrará igual`,
        );
      }
      if (l.cantidad_recibida < 1) {
        toast.warning(`"${l.producto_nombre}": mínimo 1 unidad`);
        return;
      }
    }

    let factura_archivo_url: string | undefined;
    if (factura_archivo) {
      try {
        const supabase = createClient();
        const ext = factura_archivo.name.split(".").pop() || "bin";
        const fileName = `factura-${Date.now()}.${ext}`;
        const path = `recepciones/nuevas/${fileName}`;
        const { error } = await supabase.storage
          .from("facturas-proveedores")
          .upload(path, factura_archivo, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage
          .from("facturas-proveedores")
          .getPublicUrl(path);
        factura_archivo_url = data.publicUrl;
      } catch (e) {
        toast.warning(
          `No se pudo subir el archivo de factura (${(e as Error).message}); se registra la recepción sin él.`,
        );
      }
    }

    recibir.execute({
      oc_id: recepcionOc.id,
      items: conCantidad.map((l) => ({
        oc_item_id: l.oc_item_id,
        cantidad_recibida: l.cantidad_recibida,
        serial: l.serial.trim() || undefined,
        observaciones: l.observaciones.trim() || undefined,
        fotos: l.fotos,
      })),
      factura_numero: factura_numero.trim() || undefined,
      factura_fecha,
      factura_monto: Number(factura_monto) || 0,
      factura_archivo_url,
      observaciones: observaciones.trim() || undefined,
    });
  };

  const registrarIngreso = () => {
    if (!ingresoOc) return;
    if (!deposito_id) {
      toast.warning("Selecciona el depósito de destino");
      return;
    }
    ingresar.execute({ oc_id: ingresoOc.id, deposito_id });
  };

  const totalRecibidoUnidades = lineas.reduce(
    (s, l) => s + l.cantidad_recibida,
    0,
  );
  const totalSolicitadoUnidades = lineas.reduce(
    (s, l) => s + l.cantidad_solicitada,
    0,
  );

  const TarjetaOc = ({
    oc,
    motivo,
    verificado,
  }: {
    oc: OcDTO;
    motivo: string;
    verificado: boolean;
  }) => (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-medium text-blue-700 dark:text-blue-400">
            {oc.numero_orden}
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {oc.proveedor_nombre ?? "—"}
          </p>
          <p className="text-xs text-zinc-500">
            {oc.items.length} ítems · {formatGs(oc.total)}
          </p>
        </div>
        <button
          onClick={verificado ? abrirRecepcion.bind(null, oc) : () => setIngresoOc(oc)}
          disabled={recibir.isPending || ingresar.isPending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {verificado ? (
            <>
              <PackageCheck className="h-3.5 w-3.5" /> Registrar Recepción
            </>
          ) : (
            <>
              <ArrowDownToLine className="h-3.5 w-3.5" /> Ingresar a stock
            </>
          )}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{motivo}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <PackageCheck className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Recepción de Mercadería
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Registrar recepciones de OC e ingresar la mercadería a stock
          </p>
        </div>
        <button
          onClick={() =>
            setCreandoProdCtx({
              idx: null,
              nombre: "",
              codigo: "",
              barcode: "",
              descripcion: "",
              precioVenta: 0,
              costo: 0,
            })
          }
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Truck className="h-4 w-4" /> Pendientes de recepción
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {pendientesRecepcion.length}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Warehouse className="h-4 w-4" /> Pendientes de ingreso a stock
          </p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {pendientesIngreso.length}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          <Truck className="h-4 w-4" /> Pendientes de recepción
        </h2>
        {pendientesRecepcion.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pendientesRecepcion.map((oc) => (
              <TarjetaOc
                key={oc.id}
                oc={oc}
                motivo="Mercadería pendiente de recepción. Puedes recibir total o parcialmente."
                verificado
              />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">
            No hay OC pendientes de recepción.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          <Warehouse className="h-4 w-4" /> Pendientes de ingreso a stock
        </h2>
        {pendientesIngreso.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pendientesIngreso.map((oc) => (
              <TarjetaOc
                key={oc.id}
                oc={oc}
                motivo="Mercadería recibida. Falta ingresarla al depósito."
                verificado={false}
              />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">
            No hay OC pendientes de ingreso a stock.
          </p>
        )}
      </div>

      {recepcionOc && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Registrar recepción
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {recepcionOc.numero_orden} · {recepcionOc.proveedor_nombre}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  N° Factura
                </label>
                <input
                  type="text"
                  value={factura_numero}
                  onChange={(e) => setFacturaNumero(e.target.value)}
                  placeholder="001-001-0000000"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Fecha factura
                </label>
                <input
                  type="date"
                  value={factura_fecha}
                  onChange={(e) => setFacturaFecha(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Monto factura
                </label>
                <input
                  type="number"
                  min={0}
                  value={factura_monto || ""}
                  onChange={(e) => setFacturaMonto(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                />
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Adjuntar archivo de factura (PDF / Imagen)
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setFacturaArchivo(e.target.files?.[0] || null)}
                className="w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                    <th className="px-2 py-2 font-medium">Barcode</th>
                    <th className="px-2 py-2 font-medium">Producto</th>
                    <th className="px-2 py-2 text-center font-medium">Sol.</th>
                    <th className="px-2 py-2 text-center font-medium">Recibir</th>
                    <th className="px-2 py-2 font-medium">
                      Serial <span className="text-zinc-400">(Enter →)</span>
                    </th>
                    <th className="px-2 py-2 font-medium">Foto</th>
                    <th className="px-2 py-2 font-medium">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr
                      key={`${l.oc_item_id}-${i}`}
                      className="border-b border-zinc-100 dark:border-zinc-800/60"
                    >
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={l.barcode}
                          onChange={(e) =>
                            actualizarLinea(i, { barcode: e.target.value })
                          }
                          onBlur={(e) => resolverBarcode(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs"
                          placeholder="Escanear..."
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={l.producto_nombre}
                          onChange={(e) =>
                            actualizarLinea(i, { producto_nombre: e.target.value })
                          }
                          className="w-44 rounded border border-zinc-300 bg-white px-2 py-1 text-sm font-medium"
                          placeholder="Nombre del producto"
                        />
                        {l.producto_codigo && (
                          <span className="ml-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                            {l.producto_codigo}
                          </span>
                        )}
                        {!l.producto_id && l.barcode && (
                          <span className="ml-1 inline-block rounded bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600">
                            Producto nuevo
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                          {l.cantidad_solicitada}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={l.cantidad_recibida}
                          onChange={(e) =>
                            actualizarLinea(i, {
                              cantidad_recibida: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className={`w-16 rounded border px-2 py-1 text-center text-sm ${
                            l.cantidad_recibida > l.cantidad_solicitada
                              ? "border-amber-400 bg-amber-50"
                              : l.cantidad_recibida < 1
                                ? "border-red-400 bg-red-50"
                                : "border-zinc-300 bg-white"
                          }`}
                        />
                        {l.cantidad_recibida > l.cantidad_solicitada && (
                          <span className="ml-1 text-[10px] font-medium text-amber-600">
                            +{l.cantidad_recibida - l.cantidad_solicitada}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <Barcode className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          <input
                            ref={(el) => {
                              serialRefs.current[i] = el;
                            }}
                            type="text"
                            value={l.serial}
                            onChange={(e) =>
                              actualizarLinea(i, { serial: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                avanzarSerial(i);
                              }
                            }}
                            className="w-36 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs"
                            placeholder="Escanear código..."
                          />
                          {l.cantidad_recibida > 1 && (
                            <button
                              onClick={() => desglosarSeriales(i)}
                              className="shrink-0 rounded p-1 text-blue-600 hover:bg-blue-50"
                              title="Desglosar seriales"
                            >
                              <Split className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => abrirCamara(i)}
                              className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                            >
                              <Camera className="h-3.5 w-3.5" /> Foto
                            </button>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              ref={(el) => {
                                fileInputRefs.current[i] = el;
                              }}
                              onChange={(e) => {
                                const files = e.target.files;
                                if (files) {
                                  Array.from(files).forEach((f) =>
                                    subirFotoDesdeArchivo(i, f),
                                  );
                                }
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                            <button
                              onClick={() => fileInputRefs.current[i]?.click()}
                              className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                            >
                              <Upload className="h-3.5 w-3.5" /> Subir
                            </button>
                            {l.producto_id && (
                              <button
                                onClick={() => aplicarATodos(i)}
                                className="rounded p-1 text-blue-600 hover:bg-blue-50"
                                title="Aplicar a todos los ítems del mismo producto"
                              >
                                ⟳
                              </button>
                            )}
                          </div>
                          {l.fotos.length > 0 && (
                            <div className="flex gap-1">
                              {l.fotos.map((url, fi) => (
                                <a
                                  key={fi}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block h-8 w-8 overflow-hidden rounded border"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={l.observaciones}
                          onChange={(e) =>
                            actualizarLinea(i, { observaciones: e.target.value })
                          }
                          className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                          placeholder="Opcional"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              Total: {totalSolicitadoUnidades} solicitadas /{" "}
              {totalRecibidoUnidades} a recibir
            </p>

            <div className="mt-3 space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Observaciones generales
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={cerrarModalRecepcion}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={registrar}
                disabled={recibir.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {recibir.isPending ? "Registrando..." : "Registrar recepción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ingresoOc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <Warehouse className="h-5 w-5 text-emerald-600" /> Ingreso a stock
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {ingresoOc.numero_orden} · {ingresoOc.proveedor_nombre}
            </p>

            <div className="mt-4 space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Depósito de destino *
              </label>
              {depositos.length > 0 ? (
                <select
                  value={deposito_id}
                  onChange={(e) => setDepositoId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar depósito...</option>
                  {depositos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  No hay depósitos activos. Configura un depósito primero.
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setIngresoOc(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={registrarIngreso}
                disabled={ingresar.isPending || depositos.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {ingresar.isPending ? "Ingresando..." : "Ingresar a stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: crear producto (desde escaneo o desde encabezado) */}
      {creandoProdCtx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Producto nuevo
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {creandoProdCtx.idx !== null
                ? "Se creará y asignará a la línea escaneada."
                : "Se agregará al catálogo; podrás usarlo en una nueva OC."}
            </p>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Código
                </label>
                <input
                  value={creandoProdCtx.codigo}
                  onChange={(e) =>
                    setCreandoProdCtx((c) =>
                      c ? { ...c, codigo: e.target.value } : c,
                    )
                  }
                  placeholder="Código sugerido automáticamente"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Barcode
                </label>
                <input
                  value={creandoProdCtx.barcode}
                  disabled
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nombre *
                </label>
                <input
                  autoFocus
                  value={creandoProdCtx.nombre}
                  onChange={(e) =>
                    setCreandoProdCtx((c) =>
                      c ? { ...c, nombre: e.target.value } : c,
                    )
                  }
                  placeholder="Nombre del producto"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Precio de venta (₲)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={creandoProdCtx.precioVenta || ""}
                    onChange={(e) =>
                      setCreandoProdCtx((c) =>
                        c ? { ...c, precioVenta: Number(e.target.value) || 0 } : c,
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Costo de compra (₲)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={creandoProdCtx.costo || ""}
                    onChange={(e) =>
                      setCreandoProdCtx((c) =>
                        c ? { ...c, costo: Number(e.target.value) || 0 } : c,
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Descripción
                </label>
                <textarea
                  value={creandoProdCtx.descripcion}
                  onChange={(e) =>
                    setCreandoProdCtx((c) =>
                      c ? { ...c, descripcion: e.target.value } : c,
                    )
                  }
                  rows={2}
                  placeholder="Descripción detallada..."
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setCreandoProdCtx(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCrearProducto}
                disabled={crearProd.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {crearProd.isPending ? "Creando..." : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: cámara */}
      {camaraIdx !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Capturar foto
            </h2>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="mt-3 w-full rounded-lg border bg-black"
            />
            <canvas ref={canvasRef} className="hidden" />
            <p className="mt-2 text-center text-xs text-zinc-400">
              Alineá el producto frente a la cámara y presioná Capturar
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={cerrarCamara}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={capturarFoto}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Capturar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
