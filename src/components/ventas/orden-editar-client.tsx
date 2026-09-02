"use client";

import { numero } from "@/lib/formato";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  CreditCard,
} from "lucide-react";
import { actualizarOrdenAction } from "@/lib/actions/ventas-actions";
import {
  calcularSubtotal,
  calcularVenta,
  formatGs,
  formatUsd,
  roundMoney,
  parseDeliveryDeObservaciones,
  sinDeliveryEnObservaciones,
} from "@/lib/ventas/calculos";
import { SUCURSALES_LIST } from "@/lib/ventas/schema";
import type {
  ClienteDTO,
  ProductoVentaDTO,
  VendedorDTO,
  MetodoPagoVentaDTO,
  ConfigVentasDTO,
  OrdenDTO,
} from "@/lib/ventas/repository";

interface ItemLinea {
  producto_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  serial: string;
  stock: number;
}

type TipoVenta = "contado" | "tax_free" | "iva_incluido" | "delivery";

const TIPOS_VENTA: { value: TipoVenta; label: string }[] = [
  { value: "contado", label: "Contado" },
  { value: "tax_free", label: "Tax Free (sin IVA)" },
  { value: "iva_incluido", label: "IVA Incluido" },
  { value: "delivery", label: "Delivery" },
];

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const labelCls =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export function OrdenEditarClient({
  orden,
  clientes,
  productos,
  vendedores,
  metodosPago,
  configVentas,
  vendedorActualId,
  vendedorActualNombre,
}: {
  orden: OrdenDTO;
  clientes: ClienteDTO[];
  productos: ProductoVentaDTO[];
  vendedores: VendedorDTO[];
  metodosPago: MetodoPagoVentaDTO[];
  configVentas: ConfigVentasDTO;
  vendedorActualId: string;
  vendedorActualNombre: string;
}) {
  const router = useRouter();
  const bloqueado = orden.estado !== "pendiente";

  const stockPorProducto = useMemo(
    () => new Map(productos.map((p) => [p.id, Number(p.stock_total ?? 0)])),
    [productos],
  );

  const clienteInicial = useMemo(
    () => clientes.find((c) => c.id === orden.cliente_id) ?? null,
    [clientes, orden.cliente_id],
  );

  const [cliente, setCliente] = useState<ClienteDTO | null>(clienteInicial);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [vendedor_id, setVendedorId] = useState(
    orden.vendedor_id &&
      vendedores.some((v) => v.id === orden.vendedor_id)
      ? orden.vendedor_id
      : vendedorActualId,
  );
  const deliveryInicial = useMemo(
    () => orden.shipping_fee > 0 ? orden.shipping_fee : parseDeliveryDeObservaciones(orden.observaciones),
    [orden.observaciones, orden.shipping_fee],
  );
  const [sucursal, setSucursal] = useState(orden.sucursal ?? "ESPAÑA");
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>(
    orden.is_tax_included
      ? "iva_incluido"
      : deliveryInicial > 0
        ? "delivery"
        : "contado",
  );
  const [costoDelivery, setCostoDelivery] = useState(deliveryInicial);
  const [moneda, setMoneda] = useState<"GS" | "USD">(
    orden.moneda === "USD" ? "USD" : "GS",
  );
  const [observaciones, setObservaciones] = useState(
    sinDeliveryEnObservaciones(orden.observaciones) ?? "",
  );
  const [items, setItems] = useState<ItemLinea[]>(
    orden.items.map((it) => ({
      producto_id: it.producto_id,
      codigo: it.producto_codigo ?? "",
      nombre: it.producto_nombre,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      serial: it.serial ?? "",
      stock: stockPorProducto.get(it.producto_id) ?? 0,
    })),
  );
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [metodoPago, setMetodoPago] = useState(
    orden.terms && metodosPago.some((m) => m.nombre === orden.terms)
      ? orden.terms
      : metodosPago.find((m) => /efectivo/i.test(m.nombre))?.nombre ??
          metodosPago[0]?.nombre ??
          "efectivo",
  );

  const vendedoresList = useMemo(() => {
    if (vendedores.some((v) => v.id === vendedorActualId)) return vendedores;
    return [
      {
        id: vendedorActualId,
        nombre: vendedorActualNombre,
        apellido: "",
        vendedor_codigo: null,
      },
      ...vendedores,
    ];
  }, [vendedores, vendedorActualId, vendedorActualNombre]);

  const guardar = useAction(actualizarOrdenAction, {
    onSuccess: () => {
      toast.success("Orden actualizada");
      router.push(`/ventas/ordenes/${orden.id}`);
    },
    onError: (err) =>
      toast.error(err.error.serverError ?? "Error al actualizar la orden"),
  });

  const catálogo = useMemo(() => {
    const q = busquedaProducto.trim().toLowerCase();
    if (!q) return productos.slice(0, 40);
    return productos
      .filter(
        (p) =>
          (p.codigo ?? "").toLowerCase().includes(q) ||
          p.nombre.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [productos, busquedaProducto]);

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes.slice(0, 6);
    return clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          c.apellido.toLowerCase().includes(q) ||
          c.cedula.toLowerCase().includes(q) ||
          (c.ruc ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [clientes, busquedaCliente]);

  const tipoCambio = configVentas.tipo_cambio_usd || 7500;
  const subtotal = useMemo(() => calcularSubtotal(items), [items]);
  const costoOpPct =
    metodosPago.find((m) => m.nombre === metodoPago)?.porcentaje_costo ?? 0;
  const preview = useMemo(
    () =>
      calcularVenta(subtotal, {
        tipo_venta: tipoVenta,
        costo_operativo_porcentaje:
          costoOpPct > 0 ? costoOpPct : configVentas.costo_operativo_global,
        comision_porcentaje: configVentas.porcentaje_comision_vendedor,
        costo_delivery:
          tipoVenta === "delivery" && moneda === "GS" ? costoDelivery : 0,
      }),
    [subtotal, tipoVenta, costoOpPct, configVentas, costoDelivery, moneda],
  );

  const totalUnd = items.reduce((s, it) => s + it.cantidad, 0);
  const sinStock = items.find((it) => it.cantidad > Math.max(0, it.stock));

  const fmt = (n: number) =>
    moneda === "USD" ? formatUsd(n / tipoCambio) : formatGs(n);

  const puedeGuardar = Boolean(
    !bloqueado &&
      cliente &&
      vendedor_id &&
      items.length > 0 &&
      items.every((i) => i.cantidad > 0) &&
      subtotal > 0 &&
      !sinStock &&
      !guardar.isPending,
  );

  const agregarProducto = (p: ProductoVentaDTO) => {
    const existe = items.find((it) => it.producto_id === p.id);
    if (existe) {
      setItems((prev) =>
        prev.map((it) =>
          it.producto_id === p.id
            ? {
                ...it,
                cantidad: Math.min(
                  it.cantidad + 1,
                  Math.max(0, p.stock_total) || 9999,
                ),
              }
            : it,
        ),
      );
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        producto_id: p.id,
        codigo: p.codigo ?? "",
        nombre: p.nombre,
        cantidad: 1,
        precio_unitario: Number(p.precio_base) || 0,
        serial: "",
        stock: Number(p.stock_total) || 0,
      },
    ]);
  };

  const actualizarItem = (idx: number, cambios: Partial<ItemLinea>) =>
    setItems((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)),
    );

  const quitarItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (bloqueado) return;
    if (!cliente) {
      toast.warning("Selecciona un cliente");
      return;
    }
    if (!vendedor_id) {
      toast.warning("Selecciona un vendedor");
      return;
    }
    if (sinStock) {
      toast.warning("Hay ítems que superan el stock disponible");
      return;
    }
    guardar.execute({
      id: orden.id,
      data: {
        cliente_id: cliente.id,
        vendedor_id: vendedores.some((v) => v.id === vendedor_id)
          ? vendedor_id
          : undefined,
        items: items.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          serial: i.serial.trim() || undefined,
        })),
        sucursal,
        moneda,
        tipo_venta: tipoVenta,
        costo_delivery:
          tipoVenta === "delivery" && moneda === "GS" ? costoDelivery : 0,
        metodo_pago: metodoPago,
        observaciones: observaciones.trim() || undefined,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/ventas/ordenes/${orden.id}`)}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Editar Orden {orden.numero_orden}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Solo se pueden editar órdenes pendientes
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!puedeGuardar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Save className="h-4 w-4" />{" "}
          {guardar.isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {bloqueado && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300">
          Esta orden ya fue {orden.estado === "cancelada" ? "cancelada" : "completada"}{" "}
          y no puede modificarse.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ── Catálogo de productos ── */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            <ShoppingCart className="h-4 w-4 text-blue-600" /> Productos
          </h2>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              placeholder="Buscar por código, nombre o marca..."
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {catálogo.length === 0 && (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-900">
                Sin resultados
              </p>
            )}
            {catálogo.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {p.nombre}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {p.codigo ?? "—"} · stock: {p.stock_total} ·{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {formatGs(Number(p.precio_base) || 0)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => agregarProducto(p)}
                  disabled={(p.stock_total ?? 0) <= 0}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Columna principal ── */}
        <div className="space-y-5">
          {/* Datos de la Venta */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              <User className="h-4 w-4 text-blue-600" /> Datos de la Venta
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelCls}>Cliente</label>
                {cliente ? (
                  <div className="flex items-center justify-between rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {cliente.nombre} {cliente.apellido}
                      <span className="ml-2 font-normal text-zinc-500">
                        {cliente.cedula}
                      </span>
                    </span>
                    <button
                      onClick={() => {
                        setCliente(null);
                        setBusquedaCliente("");
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      value={busquedaCliente}
                      onChange={(e) => setBusquedaCliente(e.target.value)}
                      placeholder="Buscar por nombre o cédula..."
                      className={inputCls}
                    />
                    {busquedaCliente.trim() !== "" && (
                      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                        {clientesFiltrados.length === 0 && (
                          <p className="bg-white px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-950">
                            Sin resultados
                          </p>
                        )}
                        {clientesFiltrados.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setCliente(c);
                              setBusquedaCliente("");
                            }}
                            className="block w-full border-b border-zinc-100 bg-white px-3 py-2 text-left text-sm hover:bg-blue-50 last:border-0 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                          >
                            <span className="font-medium text-zinc-900 dark:text-zinc-50">
                              {c.nombre} {c.apellido}
                            </span>
                            <span className="ml-2 text-zinc-500">{c.cedula}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Vendedor *</label>
                <select
                  value={vendedor_id}
                  onChange={(e) => setVendedorId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Seleccionar vendedor...</option>
                  {vendedoresList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre} {v.apellido}
                      {v.vendedor_codigo ? ` · ${v.vendedor_codigo}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Sucursal *</label>
                <select
                  value={sucursal}
                  onChange={(e) => setSucursal(e.target.value)}
                  className={inputCls}
                >
                  {SUCURSALES_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Moneda</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMoneda("GS")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      moneda === "GS"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    ₲ GS
                  </button>
                  <button
                    onClick={() => setMoneda("USD")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      moneda === "USD"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    $ USD
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Tipo de Venta</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {TIPOS_VENTA.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTipoVenta(t.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      tipoVenta === t.value
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Costo Delivery */}
            {tipoVenta === "delivery" && (
              <div className="mt-4">
                <label className={labelCls}>
                  Costo Delivery (₲)
                  {moneda === "USD" && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      solo disponible en GS
                    </span>
                  )}
                </label>
                {moneda === "GS" ? (
                  <div className="mt-1.5 relative">
                    <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-zinc-400">
                      ₲
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={costoDelivery > 0 ? formatGs(costoDelivery).replace("₲ ", "") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setCostoDelivery(raw ? parseInt(raw, 10) : 0);
                      }}
                      placeholder="0"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                ) : (
                  <p className="mt-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-900">
                    El delivery se calcula solo en guaraníes. Cambiá la moneda a GS.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 space-y-1.5">
              <label className={labelCls}>Observaciones</label>
              <input
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Ítems */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                <ShoppingCart className="h-4 w-4 text-blue-600" /> Ítems de la
                venta
              </h2>
              {moneda === "USD" && (
                <span className="text-xs text-zinc-500">
                  1 US$ = ₲ {numero(tipoCambio)}
                </span>
              )}
            </div>

            {items.length === 0 && (
              <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-900">
                Agregá productos desde el catálogo de la izquierda
              </p>
            )}

            {items.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Código</th>
                      <th className="px-2 py-2">Producto</th>
                      <th className="px-2 py-2">Cant.</th>
                      <th className="px-2 py-2">Precio Unit.</th>
                      <th className="px-2 py-2">Serial</th>
                      <th className="px-2 py-2">Subtotal</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((l, i) => (
                      <tr
                        key={`${l.producto_id}-${i}`}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                      >
                        <td className="px-2 py-2 text-zinc-500">{i + 1}</td>
                        <td className="px-2 py-2 text-zinc-500">
                          {l.codigo || "—"}
                        </td>
                        <td className="px-2 py-2">
                          <div className="max-w-[200px]">
                            <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                              {l.nombre}
                            </p>
                            {l.cantidad > Math.max(0, l.stock) && (
                              <p className="text-xs text-red-600">
                                excede stock ({l.stock})
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                actualizarItem(i, {
                                  cantidad: Math.max(1, l.cantidad - 1),
                                })
                              }
                              className="rounded border border-zinc-300 p-1 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={l.cantidad}
                              onChange={(e) =>
                                actualizarItem(i, {
                                  cantidad: Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  ),
                                })
                              }
                              className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                            />
                            <button
                              onClick={() =>
                                actualizarItem(i, {
                                  cantidad: l.cantidad + 1,
                                })
                              }
                              className="rounded border border-zinc-300 p-1 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            value={l.precio_unitario}
                            onChange={(e) =>
                              actualizarItem(i, {
                                precio_unitario: Number(e.target.value) || 0,
                              })
                            }
                            className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                          <span className="ml-1 text-xs text-zinc-500">
                            {moneda === "USD"
                              ? formatUsd(l.precio_unitario / tipoCambio)
                              : "₲"}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={l.serial}
                            onChange={(e) =>
                              actualizarItem(i, { serial: e.target.value })
                            }
                            placeholder="Serial"
                            className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                        </td>
                        <td className="px-2 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                          {fmt(roundMoney(l.cantidad * l.precio_unitario))}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => quitarItem(i)}
                            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Resumen */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                <ShoppingCart className="h-4 w-4 text-blue-600" /> Resumen
              </h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>
                    Productos: {items.length} ítems ({totalUnd} und.)
                  </span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>IVA (10%)</span>
                  <span>{fmt(preview.iva)}</span>
                </div>
                {preview.costo_delivery > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Delivery</span>
                    <span>{fmt(preview.costo_delivery)}</span>
                  </div>
                )}
                {preview.costo_operativo > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Costo operativo</span>
                    <span>{fmt(preview.costo_operativo)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
                  <span>Total Cobrado</span>
                  <span>{fmt(preview.total)}</span>
                </div>
                {preview.costo_operativo > 0 && (
                  <div className="flex justify-between pt-1 text-xs text-zinc-500">
                    <span>Neto (peso descontando costo)</span>
                    <span>{fmt(preview.base)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Método de pago */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                <CreditCard className="h-4 w-4 text-blue-600" /> Método de Pago
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {metodosPago.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetodoPago(m.nombre)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      metodoPago === m.nombre
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span className="block font-medium">{m.nombre}</span>
                    {m.porcentaje_costo > 0 && (
                      <span
                        className={`text-xs ${
                          metodoPago === m.nombre
                            ? "text-blue-100"
                            : "text-zinc-500"
                        }`}
                      >
                        {m.porcentaje_costo}% costo
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}