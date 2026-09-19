import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import {
  ArrowLeft, CalendarCheck, Laptop, Package, Plus, RotateCcw, Search, Smartphone, Tablet, Trash2,
} from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated, useAutoRefreshCallback } from '@/Hooks/useAutoRefresh';
import { Badge, Button, Field, Input, Segmented, StepCard, Textarea, bsFmt, buttonCls } from '@/Components/Admin/ui';

const TERMINOS = 'La reserva se descuenta del precio final al concretar la venta. El producto queda separado mientras la reserva permanezca activa. En caso de cancelación, vencimiento o cambio de producto, Blackphone debe autorizar el ajuste antes de liberar el inventario.';

const TIPOS_PRODUCTO = [
  { value: 'celular', label: 'Celular', icon: Smartphone },
  { value: 'computadora', label: 'Computadora', icon: Laptop },
  { value: 'producto_apple', label: 'Equipo de marca', icon: Tablet },
  { value: 'producto_general', label: 'Producto general', icon: Package },
];

const etiquetaTipo = (tipo) => TIPOS_PRODUCTO.find((t) => t.value === tipo)?.label ?? 'Producto';

export default function ReservasForm({ Layout, prefijo = 'admin', guia = null }) {
  const [data, setData] = useState({
    nombre_cliente: '',
    telefono_cliente: '',
    monto_reserva: '',
    terminos_condiciones: TERMINOS,
  });
  const [stocks, setStocks] = useState({ celulares: [], computadoras: [], productosGenerales: [], productosApple: [] });
  const [productoSeleccionado, setProductoSeleccionado] = useState({ tipo: '', codigo: '', cantidad: 1, descuento: 0, producto: null });
  const [sugerenciasProductos, setSugerenciasProductos] = useState([]);
  const [mostrarProductos, setMostrarProductos] = useState(false);
  const [sugerenciasClientes, setSugerenciasClientes] = useState([]);
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [items, setItems] = useState([]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [notice, setNotice] = useState(null);
  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  const normalizarTexto = (valor) => String(valor ?? '').trim().toLowerCase();
  const normalizarIdentificador = (valor) => normalizarTexto(valor).replace(/[^a-z0-9]/g, '');

  const camposBusquedaExacta = (producto) => [
    producto.codigo,
    producto.imei_1,
    producto.imei_2,
    producto.numero_serie,
    producto.nombre,
    producto.modelo,
  ];

  const claveProducto = (producto) =>
    producto.codigo || producto.imei_1 || producto.imei_2 || producto.numero_serie || producto.nombre || producto.modelo || '';

  const prepararProducto = (producto) => ({
    ...producto,
    precio_venta: Number(producto.precio_venta ?? 0),
    precio_costo: Number(producto.precio_costo ?? 0),
  });

  const fetchStock = async () => {
    const [c, comp, pg, apple] = await Promise.all([
      axios.get(route('api.stock.celulares')),
      axios.get(route('api.stock.computadoras')),
      axios.get(route('api.stock.productos_generales')),
      axios.get(route('api.stock.productos_apple')),
    ]);
    setStocks({
      celulares: c.data,
      computadoras: comp.data,
      productosGenerales: pg.data,
      productosApple: apple.data,
    });
  };

  useEffect(() => { fetchStock(); }, []);
  useAutoRefreshCallback(fetchStock, 7000);

  const fuenteDe = (tipo) => ({
    celular: stocks.celulares,
    computadora: stocks.computadoras,
    producto_general: stocks.productosGenerales,
    producto_apple: stocks.productosApple,
  }[tipo] || []);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0), [items]);
  const abono = Number(data.monto_reserva || 0);
  const saldo = Math.max(0, subtotal - abono);

  // Sugerencias mientras escribes; al elegir una se guarda el dato exacto del producto
  const buscarSugerencias = (texto) => {
    const term = normalizarTexto(texto);
    if (!productoSeleccionado.tipo || term.length < 1) {
      setMostrarProductos(false);
      return;
    }
    const identificador = normalizarIdentificador(texto);
    const resultados = fuenteDe(productoSeleccionado.tipo).filter((p) =>
      camposBusquedaExacta(p).some((campo) => normalizarTexto(campo).includes(term)
        || (identificador.length > 0 && normalizarIdentificador(campo).includes(identificador))),
    ).map((p) => ({ ...prepararProducto(p), tipo: productoSeleccionado.tipo }));

    setSugerenciasProductos(resultados.slice(0, 10));
    setMostrarProductos(resultados.length > 0);
  };

  const seleccionarProducto = (producto) => {
    const preparado = prepararProducto(producto);
    setProductoSeleccionado({
      tipo: productoSeleccionado.tipo,
      codigo: claveProducto(preparado),
      cantidad: 1,
      descuento: 0,
      producto: preparado,
    });
    setMostrarProductos(false);
  };

  const buscarProductoPorCodigo = (tipo, codigo) => {
    const termino = normalizarTexto(codigo);
    return fuenteDe(tipo).find((p) => camposBusquedaExacta(p).some((campo) => normalizarTexto(campo) === termino));
  };

  const agregarItem = () => {
    const { tipo, producto, cantidad, descuento, codigo } = productoSeleccionado;
    if (!producto || !tipo || cantidad <= 0 || !codigo) return avisar('Falta elegir un producto', 'Busca y elige un resultado de la lista.');
    if (cantidad > 1) return avisar('Una unidad por producto', 'Solo puedes reservar una unidad a la vez.');
    if (items.some((i) => i.tipo === tipo && Number(i.producto_id) === Number(producto.id))) {
      return avisar('Ya está en la reserva', 'Este producto ya fue agregado.', 'info');
    }

    const productoExacto = buscarProductoPorCodigo(tipo, codigo);
    if (!productoExacto || Number(productoExacto.id) !== Number(producto.id)) {
      return avisar('Producto no disponible', 'Elige un producto disponible de la lista de resultados.');
    }

    const precioVenta = Number(producto.precio_venta || 0);
    const descuentoAplicado = Number(descuento || 0);
    if (descuentoAplicado > precioVenta) return avisar('Descuento demasiado alto', 'No puede superar el precio de venta.');

    setItems([...items, {
      tipo,
      producto_id: producto.id,
      cantidad: 1,
      precio_venta: precioVenta,
      descuento: descuentoAplicado,
      subtotal: precioVenta - descuentoAplicado,
      nombre: producto.nombre || producto.modelo || 'Producto',
      detalles: producto,
    }]);
    setProductoSeleccionado({ tipo, codigo: '', cantidad: 1, descuento: 0, producto: null });
    avisar('Producto separado', 'Se agregó a la reserva.', 'success');
  };

  const registrarReserva = async () => {
    if (guardando) return;
    if (!data.nombre_cliente.trim()) return avisar('Falta el cliente', 'Escribe el nombre de quien reserva.');
    if (items.length === 0) return avisar('La reserva está vacía', 'Agrega al menos un producto.');
    if (abono <= 0) return avisar('Falta el abono', 'Indica cuánto deja el cliente para reservar.');
    if (abono > subtotal) return avisar('Abono demasiado alto', 'No puede superar el total reservado.');

    setGuardando(true);
    setErrores({});

    try {
      const response = await axios.post(route(`${prefijo}.reservas.store`), { ...data, items });
      notifyRecordsUpdated();
      const reservaId = response.data.reserva_id;
      if (reservaId) window.open(`/admin/reservas/${reservaId}/boleta`, '_blank');
      router.visit(route(`${prefijo}.reservas.index`));
    } catch (error) {
      if (error.response?.status === 422) {
        setErrores(error.response.data.errors || {});
        avisar('Revisa los datos', 'Hay campos por corregir.');
      } else {
        console.error('Error al registrar reserva:', error);
        avisar('No se pudo registrar la reserva', 'Inténtalo de nuevo en unos segundos.');
      }
      setGuardando(false);
    }
  };

  const mensajesErrores = Object.values(errores || {}).flat();
  const productoActual = productoSeleccionado.producto;
  const sugerenciasAbono = subtotal > 0 ? [0.2, 0.3, 0.5].map((p) => Math.round(subtotal * p)) : [];

  return (
    <Layout title="Nueva reserva">
      <Head title="Nueva reserva" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route(`${prefijo}.reservas.index`)} aria-label="Volver a reservas"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-[#121214]" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Nueva reserva
            </h1>
            <p className="text-sm text-gris-500">Separa productos con un abono. Al guardar se abre la nota para el cliente.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Paso 1 */}
            <StepCard step={1} title="Cliente" subtitle="Escribe el nombre: si ya compró antes, aparece para elegirlo.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Field label="Nombre del cliente" error={errores.nombre_cliente}>
                    <Input
                      value={data.nombre_cliente}
                      placeholder="Ej.: María Rojas"
                      autoComplete="off"
                      onChange={async (e) => {
                        const nombre = e.target.value;
                        setData({ ...data, nombre_cliente: nombre });
                        if (nombre.length >= 2) {
                          try {
                            const res = await axios.get(route(`${prefijo}.clientes.sugerencias`, { term: nombre }));
                            setSugerenciasClientes(res.data);
                            setMostrarClientes(true);
                          } catch { setMostrarClientes(false); }
                        } else {
                          setMostrarClientes(false);
                        }
                      }}
                      onBlur={() => setTimeout(() => setMostrarClientes(false), 150)}
                    />
                  </Field>
                  {mostrarClientes && sugerenciasClientes.length > 0 && (
                    <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gris-200 bg-white text-sm shadow-xl">
                      {sugerenciasClientes.map((c) => (
                        <li key={c.id}>
                          <button type="button" className="block w-full px-4 py-2.5 text-left hover:bg-gris-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setData((d) => ({ ...d, nombre_cliente: c.nombre, telefono_cliente: c.telefono || d.telefono_cliente }));
                              setMostrarClientes(false);
                            }}>
                            <span className="block font-semibold text-gris-900">{c.nombre}</span>
                            <span className="text-xs text-gris-500">{c.telefono}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Field label="Teléfono" hint="Sirve para avisarle cuando llegue el momento de retirar.">
                  <Input value={data.telefono_cliente} placeholder="Ej.: 70000000" inputMode="tel"
                    onChange={(e) => setData({ ...data, telefono_cliente: e.target.value })} />
                </Field>
              </div>
            </StepCard>

            {/* Paso 2 */}
            <StepCard step={2} title="Productos a separar" subtitle="Elige el tipo y busca por código, IMEI, serie o nombre.">
              <Segmented
                options={TIPOS_PRODUCTO}
                value={productoSeleccionado.tipo}
                ariaLabel="Tipo de producto"
                onChange={(v) => {
                  setProductoSeleccionado({ tipo: v, codigo: '', cantidad: 1, descuento: 0, producto: null });
                  setMostrarProductos(false);
                }}
              />

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
                <Input
                  className="pl-10"
                  disabled={!productoSeleccionado.tipo}
                  placeholder={productoSeleccionado.tipo ? `Buscar ${etiquetaTipo(productoSeleccionado.tipo).toLowerCase()} por código, IMEI, serie o nombre` : 'Primero elige el tipo de producto'}
                  value={productoSeleccionado.codigo}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProductoSeleccionado((p) => ({ ...p, codigo: value, producto: null }));
                    buscarSugerencias(value);
                  }}
                  onBlur={() => setTimeout(() => setMostrarProductos(false), 150)}
                />
                {mostrarProductos && (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-gris-200 bg-white shadow-xl">
                    {sugerenciasProductos.map((p, i) => (
                      <li key={i}>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => seleccionarProducto(p)}
                          className="flex w-full items-center justify-between gap-3 border-b border-gris-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gris-50">
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-gris-900">{p.nombre || p.modelo}</span>
                            <span className="block truncate text-xs text-gris-500">{etiquetaTipo(p.tipo)} · {p.codigo || p.imei_1 || p.numero_serie}</span>
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-gris-900">{bsFmt(p.precio_venta)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {productoActual && (
                <div className="mt-4 rounded-xl border border-[rgb(var(--acento-rgb)_/_0.25)] bg-[rgb(var(--acento-rgb)_/_0.05)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--acento)]">Producto elegido</p>
                      <p className="mt-1 truncate text-base font-bold text-gris-900">{productoActual.modelo || productoActual.nombre}</p>
                      <p className="text-xs text-gris-500">
                        {etiquetaTipo(productoSeleccionado.tipo)} · {productoActual.codigo || productoActual.imei_1 || productoActual.numero_serie || 'sin código'}
                      </p>
                    </div>
                    <p className="text-xl font-extrabold text-gris-900">{bsFmt(productoActual.precio_venta)}</p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label="Descuento (Bs)">
                      <Input type="number" min={0} value={productoSeleccionado.descuento}
                        onChange={(e) => setProductoSeleccionado({ ...productoSeleccionado, descuento: Number(e.target.value) })} />
                    </Field>
                    <Button variant="primary" className="h-11 px-5" onClick={agregarItem}>
                      <Plus className="h-4 w-4" /> Agregar a la reserva
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-gris-400">Separados · {items.length}</p>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gris-200 bg-gris-50/60 px-4 py-6 text-center text-sm text-gris-500">
                    Todavía no separaste productos.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item, i) => (
                      <li key={`${item.tipo}-${item.producto_id}`} className="flex items-center gap-3 rounded-xl border border-gris-200 bg-white px-4 py-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gris-100 text-xs font-bold text-gris-500">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gris-900">{item.nombre}</p>
                          <p className="text-xs text-gris-500">
                            {etiquetaTipo(item.tipo)} · {bsFmt(item.precio_venta)}
                            {item.descuento > 0 && <span className="text-rose-600"> − {bsFmt(item.descuento)}</span>}
                          </p>
                          {(errores[`items.${i}.producto_id`] || errores[`items.${i}.descuento`]) && (
                            <p className="mt-0.5 text-xs text-rose-600">{errores[`items.${i}.producto_id`] || errores[`items.${i}.descuento`]}</p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-gris-900">{bsFmt(item.subtotal)}</p>
                        <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} aria-label={`Quitar ${item.nombre}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </StepCard>

            {/* Paso 3 */}
            <StepCard step={3} title="Abono y condiciones" subtitle="Cuánto deja el cliente hoy. El resto se cobra al vender.">
              <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr] md:items-start">
                <Field label="Abono (Bs)" error={errores.monto_reserva}>
                  <Input type="number" min={0} step="0.01" value={data.monto_reserva} placeholder="0,00"
                    onChange={(e) => setData({ ...data, monto_reserva: e.target.value })} />
                </Field>
                {sugerenciasAbono.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gris-600">Montos sugeridos</p>
                    <div className="flex flex-wrap gap-2">
                      {sugerenciasAbono.map((m, i) => (
                        <button key={i} type="button" onClick={() => setData({ ...data, monto_reserva: String(m) })}
                          className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${abono === m ? 'border-[#121214] bg-[#121214] text-white' : 'border-gris-200 bg-white text-gris-600 hover:border-gris-300 hover:text-gris-900'}`}>
                          {[20, 30, 50][i]}% · {bsFmt(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gris-600">Condiciones que se imprimen en la nota</span>
                  {data.terminos_condiciones !== TERMINOS && (
                    <button type="button" onClick={() => setData({ ...data, terminos_condiciones: TERMINOS })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--acento)] hover:text-[#121214]">
                      <RotateCcw className="h-3.5 w-3.5" /> Usar el texto de siempre
                    </button>
                  )}
                </div>
                <Textarea rows={4} value={data.terminos_condiciones} onChange={(e) => setData({ ...data, terminos_condiciones: e.target.value })} />
              </div>
            </StepCard>
          </div>

          {/* Resumen */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <CalendarCheck className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen de la reserva
                </h2>
                <Badge tone="navy">{items.length} {items.length === 1 ? 'producto' : 'productos'}</Badge>
              </div>

              <div className="space-y-4 p-5">
                {items.length > 0 && (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {items.map((item) => (
                      <li key={`r-${item.tipo}-${item.producto_id}`} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-gris-600">{item.nombre}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-gris-900">{bsFmt(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <dl className="space-y-1.5 border-t border-gris-100 pt-4 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gris-500">Total reservado</dt><dd className="font-semibold tabular-nums text-gris-900">{bsFmt(subtotal)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gris-500">Abono de hoy</dt><dd className="font-semibold tabular-nums text-emerald-700">−{bsFmt(abono)}</dd></div>
                </dl>

                <div className="rounded-xl bg-[#121214] px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Saldo al vender</p>
                  <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight">{bsFmt(saldo)}</p>
                  <p className="mt-1.5 text-xs text-white/60">Se descuenta el abono al concretar la venta.</p>
                </div>

                {mensajesErrores.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <p className="mb-1 font-semibold">Revisa estos datos:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {mensajesErrores.map((mensaje, index) => <li key={index}>{mensaje}</li>)}
                    </ul>
                  </div>
                )}

                <button type="button" onClick={registrarReserva} disabled={guardando}
                  className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  {guardando ? 'Guardando…' : 'Registrar reserva'}
                </button>
                <p className="text-center text-xs text-gris-400">Los productos quedan separados y se abre la nota.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
