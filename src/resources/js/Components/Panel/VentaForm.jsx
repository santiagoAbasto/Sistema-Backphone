import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import {
  ArrowLeft, Banknote, CalendarCheck, CreditCard, Laptop, Package, Plus, QrCode, Repeat, Search,
  ShoppingCart, Smartphone, Tablet, Trash2, X,
} from 'lucide-react';
import ModalPermutaComponent from '@/Components/ModalPermutaComponent';
import CardPaymentFields from '@/Components/CardPaymentFields';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated, useAutoRefreshCallback } from '@/Hooks/useAutoRefresh';
import { Badge, Button, Field, Input, Segmented, Select, StepCard, Switch, Textarea, bsFmt, buttonCls } from '@/Components/Admin/ui';

const TIPOS_PRODUCTO = [
  { value: 'celular', label: 'Celular', icon: Smartphone },
  { value: 'computadora', label: 'Computadora', icon: Laptop },
  { value: 'producto_apple', label: 'Equipo de marca', icon: Tablet },
  { value: 'producto_general', label: 'Producto general', icon: Package },
];

// El servidor acepta permutas de estos tipos (VentaController@store)
const TIPOS_PERMUTA = [
  { value: 'celular', label: 'Celular' },
  { value: 'computadora', label: 'Computadora' },
  { value: 'producto_general', label: 'Producto general' },
];

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'qr', label: 'QR', icon: QrCode },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
];

const etiquetaTipo = (tipo) => TIPOS_PRODUCTO.find((t) => t.value === tipo)?.label ?? 'Producto';

export default function VentaForm({ celulares, computadoras, productosGenerales, reservasActivas = [], Layout, prefijo = 'admin' }) {
  const { data, setData } = useForm({
    nombre_cliente: '',
    telefono_cliente: '',
    tipo_venta: 'producto',
    metodo_pago: 'efectivo',
    descuento: 0,
    notas_adicionales: '',
    inicio_tarjeta: '',
    fin_tarjeta: '',
    reserva_id: '',
  });

  const form = data;

  const [esPermuta, setEsPermuta] = useState(false);
  const [tipoPermuta, setTipoPermuta] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEntregado, setProductoEntregado] = useState(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState({
    tipo: '', codigo: '', cantidad: 1, descuento: 0, imei: '', producto: null,
  });

  const [stocks, setStocks] = useState({ celulares: [], computadoras: [], productosGenerales: [], productosApple: [] });
  const [errores, setErrores] = useState({});
  const [items, setItems] = useState([]);
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);
  const [notice, setNotice] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const showNotice = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

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

  const seleccionarProducto = (producto) => {
    const productoPreparado = prepararProducto(producto);

    setProductoSeleccionado({
      tipo: productoPreparado.tipo || productoSeleccionado.tipo,
      codigo: claveProducto(productoPreparado),
      cantidad: 1,
      descuento: 0,
      imei: productoPreparado.imei_1 || '',
      producto: productoPreparado,
    });

    setMostrarProductos(false);
  };

  useEffect(() => { fetchStock(); }, []);
  useAutoRefreshCallback(fetchStock, 7000);

  const agregarItem = () => {
    const { tipo, producto, cantidad, descuento, imei, codigo } = productoSeleccionado;
    if (!producto || !tipo || cantidad <= 0 || !codigo) return showNotice('Falta seleccionar un producto', 'Busca y elige un resultado antes de agregarlo.');

    if (cantidad > 1) return showNotice('Cantidad no disponible', 'Este inventario se vende una unidad por registro.');

    const yaExiste = items.some((i) => i.tipo === tipo && i.producto_id === producto.id);
    if (yaExiste) return showNotice('Producto ya agregado', 'Ya está en el resumen de la venta.', 'info');

    const precioVenta = Number(producto.precio_venta ?? 0);
    const precioCosto = Number(producto.precio_costo ?? 0);

    if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
      return showNotice('Precio de venta inválido', 'Revísalo en inventario antes de continuar.');
    }

    if (Number(descuento || 0) > precioVenta) {
      return showNotice('Descuento demasiado alto', 'El descuento no puede superar el precio de venta.');
    }

    const subtotal = (precioVenta - Number(descuento || 0)) * cantidad;
    const precio_invertido = precioCosto * cantidad;

    setItems([...items, {
      tipo,
      producto_id: producto.id,
      cantidad,
      precio_venta: precioVenta,
      precio_invertido,
      descuento: Number(descuento || 0),
      subtotal,
      nombre: producto.nombre || producto.modelo || '---',
      imei: tipo === 'celular' ? imei : null,
      detalles: producto,
    }]);

    setProductoSeleccionado({ tipo, codigo: '', cantidad: 1, descuento: 0, imei: '', producto: null });
    showNotice('Producto agregado', 'Ya forma parte de esta venta.', 'success');
    fetchStock();
  };

  const quitarItem = (index) => setItems(items.filter((_, i) => i !== index));

  const subtotalItems = items.reduce((total, item) => total + ((item.precio_venta - item.descuento) * item.cantidad), 0);
  const valorPermuta = esPermuta && productoEntregado ? Number(productoEntregado.precio_costo || 0) : 0;
  const calcularTotal = () => subtotalItems - valorPermuta - Number(form.descuento || 0);
  const montoReserva = Number(reservaSeleccionada?.monto_reserva || 0);
  const totalACobrar = Math.max(0, calcularTotal() - montoReserva);
  const mensajesErrores = Object.values(errores || {}).flat();

  const productoDesdeReserva = (item) =>
    item.celular || item.computadora || item.producto_apple || item.producto_general || {};

  const aplicarReserva = (reserva) => {
    if (!reserva) {
      setReservaSeleccionada(null);
      setData('reserva_id', '');
      return;
    }

    setReservaSeleccionada(reserva);
    setData('reserva_id', reserva.id);
    setData('nombre_cliente', reserva.nombre_cliente || '');
    setData('telefono_cliente', reserva.telefono_cliente || '');
    setItems((reserva.items || []).map((item) => {
      const producto = productoDesdeReserva(item);
      return {
        tipo: item.tipo,
        producto_id: item.producto_id,
        cantidad: item.cantidad || 1,
        precio_venta: Number(item.precio_venta || producto.precio_venta || 0),
        precio_invertido: Number(producto.precio_costo || 0) * Number(item.cantidad || 1),
        descuento: Number(item.descuento || 0),
        subtotal: Number(item.subtotal || 0),
        nombre: item.nombre_producto || producto.nombre || producto.modelo || 'Producto reservado',
        imei: item.tipo === 'celular' ? producto.imei_1 : null,
        detalles: producto,
      };
    }));
  };

  useEffect(() => {
    const reservaId = new URLSearchParams(window.location.search).get('reserva_id');
    if (!reservaId || reservaSeleccionada) return;
    const reserva = reservasActivas.find((r) => Number(r.id) === Number(reservaId));
    if (reserva) aplicarReserva(reserva);
  }, [reservasActivas]);

  // Clientes
  const [sugerenciasClientes, setSugerenciasClientes] = useState([]);
  const [mostrarClientes, setMostrarClientes] = useState(false);

  // Productos
  const [sugerenciasProductos, setSugerenciasProductos] = useState([]);
  const [mostrarProductos, setMostrarProductos] = useState(false);

  const buscarSugerencias = async (texto) => {
    const term = normalizarTexto(texto);

    if (!productoSeleccionado.tipo || term.length < 1) {
      setMostrarProductos(false);
      return;
    }

    let fuente = [];
    if (productoSeleccionado.tipo === 'celular') fuente = stocks.celulares;
    if (productoSeleccionado.tipo === 'computadora') fuente = stocks.computadoras;
    if (productoSeleccionado.tipo === 'producto_general') fuente = stocks.productosGenerales;
    if (productoSeleccionado.tipo === 'producto_apple') fuente = stocks.productosApple;

    const identificador = normalizarIdentificador(texto);
    const resultados = fuente.filter((p) =>
      camposBusquedaExacta(p).some((campo) => {
        const campoNormalizado = normalizarTexto(campo);
        return campoNormalizado.includes(term)
          || (identificador.length > 0 && normalizarIdentificador(campo).includes(identificador));
      }),
    ).map((p) => ({
      ...prepararProducto(p),
      tipo: productoSeleccionado.tipo,
    }));

    if (resultados.length > 0) {
      setSugerenciasProductos(resultados.slice(0, 10));
      setMostrarProductos(true);
      return;
    }

    // Respaldo en el servidor: detecta el tipo por IMEI/serie aunque las listas no hayan terminado de cargar
    if (/^\d{15}$/.test(identificador)) {
      try {
        const response = await axios.post(route('api.stock.buscar_codigo'), { codigo: texto.trim() });
        const encontrado = {
          ...prepararProducto(response.data.producto),
          tipo: response.data.tipo,
          _verified_by_server: true,
        };
        setSugerenciasProductos([encontrado]);
        setMostrarProductos(true);
        return;
      } catch (error) {
        if (error.response?.status !== 404) console.warn('No se pudo consultar el producto:', error);
      }
    }

    setSugerenciasProductos([]);
    setMostrarProductos(false);
  };

  const registrarVenta = async () => {
    if (enviando) return;
    if (items.length === 0) return showNotice('La venta está vacía', 'Agrega al menos un producto para continuar.');
    if (esPermuta && !productoEntregado) return showNotice('Falta el equipo de permuta', 'Registra el equipo que entrega el cliente o desactiva la permuta.');

    const payload = {
      ...form,
      items,
      es_permuta: esPermuta,
      tipo_permuta: esPermuta ? tipoPermuta : null,
      producto_entregado: productoEntregado,
      reserva_id: reservaSeleccionada?.id || form.reserva_id || null,
    };

    setEnviando(true);
    try {
      const response = await axios.post(route(`${prefijo}.ventas.store`), payload);
      notifyRecordsUpdated();
      const ventaId = response.data.venta_id;
      if (ventaId) window.open(`/admin/ventas/${ventaId}/boleta`, '_blank');
      router.visit(route(`${prefijo}.ventas.index`));
    } catch (error) {
      if (error.response?.status === 422) {
        const validationErrors = error.response.data.errors || {};
        setErrores(validationErrors);
        showNotice('Revisa los datos', 'Hay campos por corregir en el resumen.');
      } else {
        console.error('Error al registrar venta:', error);
        showNotice('No se pudo registrar la venta', 'Inténtalo de nuevo en unos segundos.');
      }
      setEnviando(false);
    }
  };

  const productoActual = productoSeleccionado.producto;

  return (
    <Layout title="Nueva venta">
      <Head title="Nueva venta" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route(`${prefijo}.ventas.index`)} aria-label="Volver a ventas"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-carbon-900" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Nueva venta
            </h1>
            <p className="text-sm text-gris-500">Completa los pasos. Al registrar se abre la nota para imprimir.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Reserva */}
            {reservasActivas.length > 0 && (
              <StepCard icon={CalendarCheck} title="¿Viene de una reserva?" subtitle="Si el cliente ya dejó un abono, elige su reserva y se cargan sus productos.">
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <Field label="Reserva activa">
                    <Select
                      value={reservaSeleccionada?.id || ''}
                      onChange={(e) => {
                        const reserva = reservasActivas.find((r) => Number(r.id) === Number(e.target.value));
                        aplicarReserva(reserva || null);
                      }}
                    >
                      <option value="">Venta sin reserva</option>
                      {reservasActivas.map((reserva) => (
                        <option key={reserva.id} value={reserva.id}>
                          {reserva.codigo_nota} · {reserva.nombre_cliente} · abono Bs {Number(reserva.monto_reserva || 0).toFixed(2)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {reservaSeleccionada && (
                    <div className="rounded-xl border border-[rgb(var(--acento-rgb)_/_0.25)] bg-[rgb(var(--acento-rgb)_/_0.06)] px-4 py-2.5 text-sm text-bronce-800">
                      Se cobra solo la diferencia: <strong>{bsFmt(totalACobrar)}</strong>
                    </div>
                  )}
                </div>
              </StepCard>
            )}

            {/* Paso 1 */}
            <StepCard step={1} title="Cliente y forma de pago" subtitle="Escribe el nombre: si ya compró antes, aparece para elegirlo.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Field label="Nombre del cliente">
                    <Input
                      value={data.nombre_cliente}
                      placeholder="Ej.: María Rojas"
                      autoComplete="off"
                      onChange={async (e) => {
                        const nombre = e.target.value;
                        setData('nombre_cliente', nombre);
                        if (nombre.length >= 2) {
                          const res = await axios.get(route(`${prefijo}.clientes.sugerencias`, { term: nombre }));
                          setSugerenciasClientes(res.data);
                          setMostrarClientes(true);
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
                              setData('nombre_cliente', c.nombre);
                              setData('telefono_cliente', c.telefono);
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

                <Field label="Teléfono">
                  <Input value={data.telefono_cliente} placeholder="Ej.: 70000000" inputMode="tel"
                    onChange={(e) => setData('telefono_cliente', e.target.value)} />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Forma de pago">
                    <Segmented options={METODOS_PAGO} value={data.metodo_pago} onChange={(v) => setData('metodo_pago', v)} ariaLabel="Forma de pago" />
                  </Field>
                </div>

                {data.metodo_pago === 'tarjeta' && (
                  <CardPaymentFields
                    titular={data.nombre_cliente}
                    inicio={data.inicio_tarjeta}
                    fin={data.fin_tarjeta}
                    errors={errores}
                    onChangeInicio={(value) => setData('inicio_tarjeta', value)}
                    onChangeFin={(value) => setData('fin_tarjeta', value)}
                  />
                )}
              </div>
            </StepCard>

            {/* Paso 2 */}
            <StepCard step={2} title="Productos" subtitle="Elige el tipo y busca por código, IMEI, serie o nombre.">
              <Segmented
                options={TIPOS_PRODUCTO}
                value={productoSeleccionado.tipo}
                ariaLabel="Tipo de producto"
                onChange={(v) => {
                  setProductoSeleccionado({ ...productoSeleccionado, tipo: v, codigo: '', producto: null });
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
                    const v = e.target.value;
                    setProductoSeleccionado((p) => ({ ...p, codigo: v, producto: null }));
                    buscarSugerencias(v);
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

              {/* Producto elegido */}
              {productoActual && (
                <div className="mt-4 rounded-xl border border-[rgb(var(--acento-rgb)_/_0.25)] bg-[rgb(var(--acento-rgb)_/_0.05)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--acento)]">Producto elegido</p>
                      <p className="mt-1 truncate text-base font-bold text-gris-900">{productoActual.modelo || productoActual.nombre}</p>
                      <p className="text-xs text-gris-500">
                        {etiquetaTipo(productoSeleccionado.tipo)} · {productoActual.codigo || productoActual.imei_1 || productoActual.numero_serie || 'sin código'} · stock {productoActual.stock ?? 1}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-gris-900">{bsFmt(productoActual.precio_venta)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Descuento (Bs)">
                      <Input type="number" min={0} value={productoSeleccionado.descuento}
                        onChange={(e) => setProductoSeleccionado({ ...productoSeleccionado, descuento: Number(e.target.value) })} />
                    </Field>
                    {productoSeleccionado.tipo === 'celular' ? (
                      <Field label="IMEI">
                        <Input placeholder="IMEI" value={productoSeleccionado.imei}
                          onChange={(e) => setProductoSeleccionado({ ...productoSeleccionado, imei: e.target.value })} />
                      </Field>
                    ) : <div className="hidden sm:block" />}
                    <Button variant="primary" className="h-11 px-5" onClick={agregarItem}>
                      <Plus className="h-4 w-4" /> Agregar a la venta
                    </Button>
                  </div>
                </div>
              )}

              {/* Productos agregados */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-gris-400">En esta venta · {items.length}</p>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gris-200 bg-gris-50/60 px-4 py-6 text-center text-sm text-gris-500">
                    Todavía no agregaste productos.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item, i) => (
                      <li key={`${item.tipo}-${item.producto_id}`} className="flex items-center gap-3 rounded-xl border border-gris-200 bg-white px-4 py-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gris-100 text-xs font-bold text-gris-500">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gris-900">{item.nombre}</p>
                          <p className="text-xs text-gris-500">
                            {etiquetaTipo(item.tipo)}{item.imei ? ` · IMEI ${item.imei}` : ''} · {bsFmt(item.precio_venta)}
                            {item.descuento > 0 && <span className="text-rose-600"> − {bsFmt(item.descuento)}</span>}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-gris-900">{bsFmt(item.subtotal)}</p>
                        <button type="button" onClick={() => quitarItem(i)} aria-label={`Quitar ${item.nombre}`}
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
            <StepCard step={3} title="Permuta (opcional)" subtitle="Actívala si el cliente entrega un equipo como parte de pago."
              actions={<Switch checked={esPermuta} onChange={setEsPermuta} label="Venta con permuta" />}>
              {!esPermuta ? (
                <p className="text-[13px] text-gris-500">Sin permuta: el cliente paga el total.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <Field label="¿Qué entrega el cliente?">
                      <Select value={tipoPermuta} onChange={(e) => { setTipoPermuta(e.target.value); setProductoEntregado(null); }}>
                        <option value="">Elige el tipo</option>
                        {TIPOS_PERMUTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </Field>
                    <Button variant="primary" className="h-11 px-5" disabled={!tipoPermuta} onClick={() => setModalAbierto(true)}>
                      <Repeat className="h-4 w-4" /> {productoEntregado ? 'Cambiar datos' : 'Registrar equipo'}
                    </Button>
                  </div>

                  {productoEntregado && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-emerald-900">
                          {productoEntregado.modelo || productoEntregado.nombre || 'Equipo entregado'}
                        </p>
                        <p className="text-xs text-emerald-800">Se descuenta {bsFmt(productoEntregado.precio_costo)} del total</p>
                      </div>
                      <button type="button" onClick={() => setProductoEntregado(null)} aria-label="Quitar equipo de permuta"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-100">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </StepCard>
          </div>

          {/* Resumen tipo carrito */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
              <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <ShoppingCart className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen de la venta
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
                  <div className="flex justify-between gap-3"><dt className="text-gris-500">Subtotal</dt><dd className="font-semibold tabular-nums text-gris-900">{bsFmt(subtotalItems)}</dd></div>
                  {valorPermuta > 0 && (
                    <div className="flex justify-between gap-3"><dt className="text-gris-500">Permuta</dt><dd className="font-semibold tabular-nums text-rose-600">−{bsFmt(valorPermuta)}</dd></div>
                  )}
                  {montoReserva > 0 && (
                    <div className="flex justify-between gap-3"><dt className="text-gris-500">Abono de la reserva</dt><dd className="font-semibold tabular-nums text-rose-600">−{bsFmt(montoReserva)}</dd></div>
                  )}
                </dl>

                <div className="rounded-xl bg-carbon-900 px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Total a cobrar</p>
                  <p className="mt-1 text-[28px] font-bold leading-none tracking-tight">{bsFmt(totalACobrar)}</p>
                  <p className="mt-1.5 text-xs text-white/60">{METODOS_PAGO.find((m) => m.value === data.metodo_pago)?.label}</p>
                </div>

                <Field label="Notas (opcional)">
                  <Textarea rows={2} placeholder="Ej.: se entregó con cargador y funda" value={data.notas_adicionales}
                    onChange={(e) => setData('notas_adicionales', e.target.value)} />
                </Field>

                {mensajesErrores.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <p className="mb-1 font-semibold">Revisa estos datos:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {mensajesErrores.map((mensaje, index) => <li key={index}>{mensaje}</li>)}
                    </ul>
                  </div>
                )}

                <button type="button" onClick={registrarVenta} disabled={enviando}
                  className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  {enviando ? 'Registrando…' : 'Registrar venta'}
                </button>
                <p className="text-center text-xs text-gris-400">Se descuenta del inventario y se abre la nota.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <ModalPermutaComponent
        show={modalAbierto}
        tipo={tipoPermuta}
        onClose={() => setModalAbierto(false)}
        onGuardar={(producto) => {
          setProductoEntregado(producto);
          setModalAbierto(false);
        }}
      />
    </Layout>
  );
}
