import { Head, Link, useForm } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useMemo, useState } from 'react';
import {
  ArrowLeft, Banknote, CheckCircle2, CreditCard, FileText, Package, Plus, QrCode, Save, Search,
  SlidersHorizontal, Trash2, User, Wrench,
} from 'lucide-react';
import CardPaymentFields from '@/Components/CardPaymentFields';
import { Badge, Field, Input, Segmented, Select, StepCard, Textarea, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';

const money = (value) => Number(value || 0);

const productTypes = [
  { value: 'celular', label: 'Celular' },
  { value: 'computadora', label: 'Computadora' },
  { value: 'producto_general', label: 'Producto general' },
  { value: 'producto_apple', label: 'Equipo de marca' },
];

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'qr', label: 'QR', icon: QrCode },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
];

const productoNombre = (item) => {
  if (item.nombre_producto) return item.nombre_producto;
  if (item.celular?.modelo) return item.celular.modelo;
  if (item.computadora?.nombre) return item.computadora.nombre;
  if (item.producto_apple?.modelo) return item.producto_apple.modelo;
  if (item.producto_general?.nombre) return item.producto_general.nombre;
  return 'Producto';
};

const productoRelacion = (item) => (
  item.celular || item.computadora || item.producto_apple || item.producto_general || null
);

const productTitle = (product) => (
  product?.nombre || product?.modelo || product?.codigo || product?.numero_serie || 'Producto'
);

const productCode = (product) => (
  product?.codigo || product?.imei_1 || product?.imei_2 || product?.numero_serie || ''
);

const productSubtitle = (product, tipo) => {
  const parts = [
    productCode(product),
    product?.capacidad,
    product?.color,
    product?.bateria ? `Batería ${product.bateria}` : null,
    product?.procesador,
    product?.ram,
    product?.almacenamiento,
    product?.estado && product.estado !== 'disponible' ? product.estado : null,
  ].filter(Boolean);

  return `${productTypes.find((type) => type.value === tipo)?.label || 'Producto'}${parts.length ? ` · ${parts.join(' · ')}` : ''}`;
};

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

const searchText = (product) => normalizeText([
  product?.codigo,
  product?.imei_1,
  product?.imei_2,
  product?.numero_serie,
  product?.nombre,
  product?.modelo,
  product?.tipo,
  product?.capacidad,
  product?.color,
  product?.bateria,
  product?.procesador,
  product?.ram,
  product?.almacenamiento,
].filter(Boolean).join(' '));

const productSearchScore = (product, terms) => {
  const title = normalizeText(productTitle(product));
  const code = normalizeText(productCode(product));
  const imeiOne = normalizeText(product?.imei_1);
  const imeiTwo = normalizeText(product?.imei_2);
  const serie = normalizeText(product?.numero_serie);
  const searchable = searchText(product);

  return terms.reduce((score, term) => {
    if (code === term || imeiOne === term || imeiTwo === term || serie === term) return score + 100;
    if (code.startsWith(term) || imeiOne.startsWith(term) || imeiTwo.startsWith(term) || serie.startsWith(term)) return score + 70;
    if (title.startsWith(term)) return score + 50;
    if (title.includes(term)) return score + 30;
    if (searchable.includes(term)) return score + 10;
    return score;
  }, 0);
};

const displaySearchValue = (tipo, product, fallback = '') => {
  if (!product) return fallback;
  const code = productCode(product);
  return `${productTitle(product)}${code ? ` - ${code}` : ''}`;
};

const productId = (value) => Number(value || 0);

export default function VentaEditForm({
  venta,
  productosGenerales = [],
  inventarioEdicion = {},
  routePrefix,
  // eslint-disable-next-line no-unused-vars
}) {
  const servicio = venta.servicio_tecnico || {};
  const esServicio = venta.tipo_venta === 'servicio_tecnico' && Boolean(servicio.id);
  const [selectorActivo, setSelectorActivo] = useState(null);
  const [selectorErrores, setSelectorErrores] = useState({});
  const [nuevoProducto, setNuevoProducto] = useState({
    tipo: 'producto_general',
    busqueda: '',
    producto: null,
  });

  const inventario = useMemo(() => ({
    celular: inventarioEdicion.celulares || [],
    computadora: inventarioEdicion.computadoras || [],
    producto_general: inventarioEdicion.productosGenerales?.length
      ? inventarioEdicion.productosGenerales
      : productosGenerales,
    producto_apple: inventarioEdicion.productosApple || [],
  }), [inventarioEdicion, productosGenerales]);

  const findProduct = (tipo, id) => (
    (inventario[tipo] || []).find((product) => productId(product.id) === productId(id)) || null
  );

  const initialItems = (venta.items || []).map((item) => {
    const product = productoRelacion(item);
    const tipo = item.tipo || '';
    const nombreActual = productoNombre(item);
    const productoActualId = item.producto_id || product?.id || '';

    return {
      id: item.id,
      local_id: item.id ? null : `item-${Date.now()}-${Math.random()}`,
      tipo,
      producto_id: productoActualId,
      nombre: nombreActual,
      original_tipo: tipo,
      original_producto_id: productoActualId,
      original_nombre: nombreActual,
      original_detalle: product ? productSubtitle(product, tipo) : tipo,
      original_precio_venta: money(item.precio_venta),
      original_precio_invertido: money(item.precio_invertido),
      original_cantidad: item.cantidad || 1,
      replace_tipo: tipo,
      replace_busqueda: '',
      cantidad: item.cantidad || 1,
      precio_venta: money(item.precio_venta),
      precio_invertido: money(item.precio_invertido),
      descuento: money(item.descuento),
    };
  });

  const { data, setData, put, processing, errors } = useForm({
    nombre_cliente: venta.nombre_cliente || '',
    telefono_cliente: venta.telefono_cliente || '',
    metodo_pago: venta.metodo_pago || 'efectivo',
    inicio_tarjeta: venta.inicio_tarjeta || '',
    fin_tarjeta: venta.fin_tarjeta || '',
    notas_adicionales: venta.notas_adicionales || servicio.notas_adicionales || '',
    descuento: money(venta.descuento),
    valor_permuta: money(venta.valor_permuta),
    items: initialItems,
    servicio_tecnico: {
      equipo: servicio.equipo || '',
      detalle_servicio: servicio.detalle_servicio || '',
      tecnico: servicio.tecnico || '',
      precio_costo: money(servicio.precio_costo ?? venta.precio_invertido),
      precio_venta: money(servicio.precio_venta ?? venta.precio_venta),
    },
  });

  const hasDuplicate = (tipo, id, currentIndex = null) => data.items.some((item, index) => (
    index !== currentIndex && item.tipo === tipo && productId(item.producto_id) === productId(id)
  ));

  const clearSelectorError = (key) => {
    setSelectorErrores((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const setSelectorError = (key, message) => {
    setSelectorErrores((current) => ({ ...current, [key]: message }));
  };

  const filteredProducts = (tipo, query, limit = 8) => {
    const products = inventario[tipo] || [];
    const terms = normalizeText(query).trim().split(/\s+/).filter(Boolean);

    if (!terms.length) {
      return products.slice(0, limit);
    }

    return products
      .map((product) => ({
        product,
        score: productSearchScore(product, terms),
      }))
      .filter(({ product, score }) => {
        const searchable = searchText(product);
        return score > 0 && terms.every((term) => searchable.includes(term));
      })
      .sort((first, second) => second.score - first.score)
      .map(({ product }) => product)
      .slice(0, limit);
  };

  const patchItem = (index, patch) => {
    setData('items', data.items.map((item, i) => (
      i === index ? { ...item, ...patch } : item
    )));
  };

  const selectProductForItem = (index, product) => {
    const item = data.items[index];
    if (!item || !product) return;
    const tipoReemplazo = item.replace_tipo || item.tipo;

    if (hasDuplicate(tipoReemplazo, product.id, index)) {
      setSelectorError(`item-${index}`, 'Ese producto ya está en otra línea de la venta.');
      return;
    }

    const cantidad = tipoReemplazo === 'producto_general' ? Math.max(1, Number(item.cantidad || 1)) : 1;

    patchItem(index, {
      tipo: tipoReemplazo,
      producto_id: product.id,
      nombre: productTitle(product),
      replace_busqueda: displaySearchValue(tipoReemplazo, product),
      cantidad,
      precio_venta: money(product.precio_venta),
      precio_invertido: money(product.precio_costo) * cantidad,
    });
    clearSelectorError(`item-${index}`);
    setSelectorActivo(null);
  };

  const updateItem = (index, field, value) => {
    const item = data.items[index];
    if (!item) return;

    if (field === 'replace_tipo') {
      patchItem(index, {
        replace_tipo: value,
        replace_busqueda: '',
      });
      clearSelectorError(`item-${index}`);
      return;
    }

    if (field === 'replace_busqueda') {
      patchItem(index, {
        replace_busqueda: value,
      });
      clearSelectorError(`item-${index}`);
      setSelectorActivo(`item-${index}`);
      return;
    }

    if (field === 'cantidad') {
      const cantidad = Math.max(1, Number(value || 1));
      const selectedProduct = findProduct(item.tipo, item.producto_id);
      patchItem(index, {
        cantidad,
        precio_invertido: selectedProduct ? money(selectedProduct.precio_costo) * cantidad : item.precio_invertido,
      });
      return;
    }

    patchItem(index, { [field]: value });
  };

  const keepOriginalItem = (index) => {
    const item = data.items[index];
    if (!item) return;

    patchItem(index, {
      tipo: item.original_tipo,
      producto_id: item.original_producto_id,
      nombre: item.original_nombre,
      replace_tipo: item.original_tipo,
      replace_busqueda: '',
      cantidad: item.original_cantidad || 1,
      precio_venta: item.original_precio_venta,
      precio_invertido: item.original_precio_invertido,
    });
    clearSelectorError(`item-${index}`);
    setSelectorActivo(null);
  };

  const removeNewItem = (index) => {
    setData('items', data.items.filter((_, i) => i !== index));
  };

  const updateServicio = (field, value) => {
    setData('servicio_tecnico', {
      ...data.servicio_tecnico,
      [field]: value,
    });
  };

  const selectNewProduct = (product) => {
    if (!product) return;
    if (hasDuplicate(nuevoProducto.tipo, product.id)) {
      setSelectorError('new', 'Ese producto ya está en la venta.');
      return;
    }

    setNuevoProducto({
      ...nuevoProducto,
      busqueda: displaySearchValue(nuevoProducto.tipo, product),
      producto: product,
    });
    clearSelectorError('new');
    setSelectorActivo(null);
  };

  const addSelectedProduct = () => {
    const product = nuevoProducto.producto;
    if (!product) {
      setSelectorError('new', 'Selecciona un producto de la lista.');
      return;
    }

    if (hasDuplicate(nuevoProducto.tipo, product.id)) {
      setSelectorError('new', 'Ese producto ya está en la venta.');
      return;
    }

    setData('items', [
      ...data.items,
      {
        id: null,
        local_id: `new-${nuevoProducto.tipo}-${product.id}-${Date.now()}`,
        tipo: nuevoProducto.tipo,
        producto_id: product.id,
        nombre: productTitle(product),
        original_tipo: nuevoProducto.tipo,
        original_producto_id: product.id,
        original_nombre: productTitle(product),
        original_detalle: productSubtitle(product, nuevoProducto.tipo),
        original_precio_venta: money(product.precio_venta),
        original_precio_invertido: money(product.precio_costo),
        original_cantidad: 1,
        replace_tipo: nuevoProducto.tipo,
        replace_busqueda: '',
        cantidad: 1,
        precio_venta: money(product.precio_venta),
        precio_invertido: money(product.precio_costo),
        descuento: 0,
      },
    ]);

    setNuevoProducto({
      tipo: 'producto_general',
      busqueda: '',
      producto: null,
    });
    clearSelectorError('new');
  };

  const subtotalProductos = data.items.reduce((total, item) => (
    total + Math.max(0, (money(item.precio_venta) - money(item.descuento)) * Number(item.cantidad || 1))
  ), 0);

  const capitalProductos = data.items.reduce((total, item) => total + money(item.precio_invertido), 0);
  const totalProductos = Math.max(0, subtotalProductos - money(data.descuento) - money(data.valor_permuta));
  const reservaAplicada = money(venta.monto_reserva_aplicado);
  const totalProductosACobrar = Math.max(0, totalProductos - reservaAplicada);
  const gananciaProductos = subtotalProductos - money(data.descuento) - money(data.valor_permuta) - capitalProductos;

  const subtotalServicio = Math.max(0, money(data.servicio_tecnico.precio_venta) - money(data.descuento));
  const gananciaServicio = subtotalServicio - money(data.servicio_tecnico.precio_costo);

  const submit = (e) => {
    e.preventDefault();
    put(route(`${routePrefix}.ventas.update`, venta.id), {
      preserveScroll: true,
    });
  };

  const hrefNota = (() => {
    try { return route(`${routePrefix}.ventas.boleta`, venta.id); } catch { return null; }
  })();
  const fechaVenta = venta.created_at
    ? new Date(venta.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const total = esServicio ? subtotalServicio : totalProductosACobrar;
  const capital = esServicio ? money(data.servicio_tecnico.precio_costo) : capitalProductos;
  const ganancia = esServicio ? gananciaServicio : gananciaProductos;

  const renderSearchBox = ({ value, placeholder, onFocus, onChange, onKeyDown, onBlur }) => (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
      <input
        className={`${inputCls} h-11 pl-10`}
        value={value}
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
    </div>
  );

  const renderSuggestions = (key, tipo, query, onPick) => {
    if (selectorActivo !== key) return null;

    const suggestions = filteredProducts(tipo, query, 6);

    return (
      <div className="overflow-hidden rounded-xl border border-gris-200 bg-white shadow-lg">
        {suggestions.length ? suggestions.map((product) => (
          <button
            key={`${tipo}-${product.id}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(product);
            }}
            className="block w-full border-b border-gris-100 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-gris-50 focus:bg-gris-50 focus:outline-none"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-semibold text-gris-900">{productTitle(product)}</span>
              <Badge tone={product.estado === 'disponible' || !product.estado ? 'emerald' : 'slate'}>{product.estado || 'disponible'}</Badge>
            </div>
            <div className="mt-0.5 truncate text-xs text-gris-500">{productSubtitle(product, tipo)}</div>
            <div className="mt-1 text-xs font-semibold text-gris-700">
              Venta {bsFmt(product.precio_venta)} · Costo {bsFmt(product.precio_costo)}
            </div>
          </button>
        )) : (
          <div className="px-3.5 py-3 text-sm text-gris-500">No hay productos disponibles con esa búsqueda.</div>
        )}
      </div>
    );
  };

  return (
    <>
      <Head title={`Editar venta ${venta.codigo_nota}`} />

      <form onSubmit={submit} className="bp-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={route(`${routePrefix}.ventas.index`)} aria-label="Volver a ventas"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[32px] font-bold leading-tight tracking-tight text-carbon-900" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
                  Editar venta
                </h1>
                <span className="rounded-lg bg-[rgb(var(--acento-rgb)_/_0.1)] px-2 py-1 cifra text-sm font-bold text-[color:var(--acento)]">{venta.codigo_nota}</span>
              </div>
              <p className="text-sm text-gris-500">
                {venta.vendedor?.name ? `Registrada por ${venta.vendedor.name}` : 'Venta registrada'}{fechaVenta ? ` el ${fechaVenta}` : ''} · los totales se recalculan al guardar.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {hrefNota && (
              <a href={hrefNota} target="_blank" rel="noopener noreferrer" className={buttonCls('secondary', 'h-11')}>
                <FileText className="h-4 w-4" /> Ver nota
              </a>
            )}
            <button type="submit" disabled={processing} className={buttonCls('primary', 'h-11 px-5')}>
              <Save className="h-4 w-4" /> {processing ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            {/* Cliente */}
            <StepCard icon={User} title="Cliente y forma de pago">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre" error={errors.nombre_cliente}>
                  <Input value={data.nombre_cliente} onChange={(e) => setData('nombre_cliente', e.target.value)} />
                </Field>
                <Field label="Teléfono">
                  <Input value={data.telefono_cliente} inputMode="tel" onChange={(e) => setData('telefono_cliente', e.target.value)} />
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
                    errors={errors}
                    onChangeInicio={(value) => setData('inicio_tarjeta', value)}
                    onChangeFin={(value) => setData('fin_tarjeta', value)}
                  />
                )}
              </div>
            </StepCard>

            {esServicio ? (
              <StepCard icon={Wrench} title="Servicio técnico">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Equipo">
                    <Input value={data.servicio_tecnico.equipo} onChange={(e) => updateServicio('equipo', e.target.value)} />
                  </Field>
                  <Field label="Técnico">
                    <Input value={data.servicio_tecnico.tecnico} onChange={(e) => updateServicio('tecnico', e.target.value)} />
                  </Field>
                  <Field label="Costo (Bs)">
                    <Input type="number" min="0" step="0.01" value={data.servicio_tecnico.precio_costo} onChange={(e) => updateServicio('precio_costo', e.target.value)} />
                  </Field>
                  <Field label="Precio cobrado (Bs)">
                    <Input type="number" min="0" step="0.01" value={data.servicio_tecnico.precio_venta} onChange={(e) => updateServicio('precio_venta', e.target.value)} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Detalle del trabajo">
                      <Textarea rows={3} value={data.servicio_tecnico.detalle_servicio} onChange={(e) => updateServicio('detalle_servicio', e.target.value)} />
                    </Field>
                  </div>
                </div>
              </StepCard>
            ) : (
              <StepCard
                icon={Package}
                title="Productos de la venta"
                subtitle="Puedes cambiar un producto por otro del inventario o corregir sus montos."
                actions={<Badge tone="lila"><CheckCircle2 className="h-3.5 w-3.5" /> Se recalcula al guardar</Badge>}
              >
                <div className="space-y-3">
                  {data.items.map((item, index) => {
                    const subtotal = Math.max(0, (money(item.precio_venta) - money(item.descuento)) * Number(item.cantidad || 1));
                    const selectorKey = `item-${index}`;
                    const replacementType = item.replace_tipo || item.tipo;
                    const isReplacing = item.original_producto_id && (
                      item.tipo !== item.original_tipo ||
                      productId(item.producto_id) !== productId(item.original_producto_id)
                    );

                    return (
                      <article key={item.id || item.local_id}
                        className={`rounded-xl border p-4 transition-colors ${isReplacing ? 'border-emerald-300 bg-emerald-50/30' : 'border-gris-200 bg-white'}`}>
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                          {/* Producto vendido */}
                          <div className="rounded-lg bg-gris-50 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gris-400">{item.id ? 'Producto vendido' : 'Producto agregado'}</p>
                            <p className="mt-1 font-semibold leading-snug text-gris-900">{item.original_nombre || item.nombre || 'Producto'}</p>
                            <p className="mt-0.5 text-xs text-gris-500">
                              {item.original_detalle || productTypes.find((type) => type.value === item.original_tipo)?.label}
                            </p>
                            <p className="mt-2 text-[11px] font-semibold text-gris-400">
                              Línea #{item.id || 'nueva'}{item.original_producto_id ? ` · Producto #${item.original_producto_id}` : ''}
                            </p>
                          </div>

                          {/* Cambiar por */}
                          <div className="min-w-0 space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gris-400">Cambiar por otro producto (opcional)</p>
                            <div className="grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
                              <Select value={replacementType} onChange={(e) => updateItem(index, 'replace_tipo', e.target.value)} aria-label="Tipo de producto">
                                {productTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                              </Select>
                              {renderSearchBox({
                                value: item.replace_busqueda,
                                placeholder: 'Nombre, código, IMEI o serie',
                                onFocus: () => setSelectorActivo(selectorKey),
                                onChange: (e) => updateItem(index, 'replace_busqueda', e.target.value),
                                onKeyDown: (e) => {
                                  if (e.key !== 'Enter') return;
                                  const firstProduct = filteredProducts(replacementType, item.replace_busqueda, 1)[0];
                                  if (!firstProduct) return;
                                  e.preventDefault();
                                  selectProductForItem(index, firstProduct);
                                },
                                onBlur: () => {
                                  setTimeout(() => {
                                    setSelectorActivo((current) => (current === selectorKey ? null : current));
                                  }, 120);
                                },
                              })}
                            </div>

                            {selectorActivo === selectorKey ? (
                              renderSuggestions(selectorKey, replacementType, item.replace_busqueda, (product) => selectProductForItem(index, product))
                            ) : isReplacing ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                <span><strong className="font-semibold">Se cambiará por:</strong> {item.nombre} · Producto #{item.producto_id}</span>
                                <button type="button" onClick={() => keepOriginalItem(index)} className="font-semibold text-emerald-700 underline underline-offset-2">
                                  Mantener el vendido
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-gris-400">Si no eliges otro, se mantiene el producto vendido.</p>
                            )}

                            {selectorErrores[selectorKey] && <p className="text-xs text-rose-600">{selectorErrores[selectorKey]}</p>}
                            {(errors[`items.${index}.producto_id`] || errors[`items.${index}.tipo`]) && (
                              <p className="text-xs text-rose-600">{errors[`items.${index}.producto_id`] || errors[`items.${index}.tipo`]}</p>
                            )}
                          </div>
                        </div>

                        {/* Montos */}
                        <div className="mt-4 grid gap-3 border-t border-gris-100 pt-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
                          <Field label="Cantidad" error={errors[`items.${index}.cantidad`]}>
                            <Input type="number" min="1" className="text-right" value={item.cantidad}
                              onChange={(e) => updateItem(index, 'cantidad', e.target.value)} disabled={item.tipo !== 'producto_general'} />
                          </Field>
                          <Field label="Precio de venta">
                            <Input type="number" min="0" step="0.01" className="text-right" value={item.precio_venta} onChange={(e) => updateItem(index, 'precio_venta', e.target.value)} />
                          </Field>
                          <Field label="Descuento" error={errors[`items.${index}.descuento`]}>
                            <Input type="number" min="0" step="0.01" className="text-right" value={item.descuento} onChange={(e) => updateItem(index, 'descuento', e.target.value)} />
                          </Field>
                          <Field label="Costo">
                            <Input type="number" min="0" step="0.01" className="text-right" value={item.precio_invertido} onChange={(e) => updateItem(index, 'precio_invertido', e.target.value)} />
                          </Field>
                          <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-end">
                            <div className="text-right">
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gris-400">Subtotal</p>
                              <p className="text-lg font-bold tabular-nums text-gris-900">{bsFmt(subtotal)}</p>
                            </div>
                            {!item.id && (
                              <button type="button" onClick={() => removeNewItem(index)} title="Quitar producto"
                                className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {errors.items && <p className="mt-3 text-sm text-rose-600">{errors.items}</p>}

                {/* Agregar otro producto */}
                <div className="mt-4 rounded-xl border border-dashed border-gris-300 bg-gris-50/60 p-4">
                  <p className="text-sm font-bold text-gris-900">Agregar otro producto</p>
                  <p className="text-xs text-gris-500">Elige el tipo y busca; no hace falta el código exacto.</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                    <Select
                      value={nuevoProducto.tipo}
                      aria-label="Tipo de producto"
                      onChange={(e) => {
                        setNuevoProducto({ tipo: e.target.value, busqueda: '', producto: null });
                        clearSelectorError('new');
                      }}
                    >
                      {productTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </Select>

                    <div className="min-w-0 space-y-2">
                      {renderSearchBox({
                        value: nuevoProducto.busqueda,
                        placeholder: 'Buscar por nombre, código, IMEI o serie',
                        onFocus: () => setSelectorActivo('new'),
                        onChange: (e) => {
                          setNuevoProducto({ ...nuevoProducto, busqueda: e.target.value, producto: null });
                          clearSelectorError('new');
                          setSelectorActivo('new');
                        },
                        onKeyDown: (e) => {
                          if (e.key !== 'Enter') return;
                          const firstProduct = filteredProducts(nuevoProducto.tipo, nuevoProducto.busqueda, 1)[0];
                          if (!firstProduct) return;
                          e.preventDefault();
                          selectNewProduct(firstProduct);
                        },
                        onBlur: () => {
                          setTimeout(() => {
                            setSelectorActivo((current) => (current === 'new' ? null : current));
                          }, 120);
                        },
                      })}
                      {renderSuggestions('new', nuevoProducto.tipo, nuevoProducto.busqueda, selectNewProduct)}
                    </div>

                    <button type="button" onClick={addSelectedProduct} disabled={!nuevoProducto.producto} className={buttonCls('primary', 'h-11 px-5')}>
                      <Plus className="h-4 w-4" /> Agregar
                    </button>
                  </div>
                  {nuevoProducto.producto && (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {displaySearchValue(nuevoProducto.tipo, nuevoProducto.producto)} · {bsFmt(nuevoProducto.producto.precio_venta)}
                    </p>
                  )}
                  {selectorErrores.new && <p className="mt-2 text-sm text-rose-600">{selectorErrores.new}</p>}
                </div>
              </StepCard>
            )}

            {/* Ajustes */}
            <StepCard icon={SlidersHorizontal} title="Ajustes y notas">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Descuento general (Bs)">
                  <Input type="number" min="0" step="0.01" value={data.descuento} onChange={(e) => setData('descuento', e.target.value)} />
                </Field>
                {!esServicio && venta.es_permuta && (
                  <Field label="Valor de la permuta (Bs)">
                    <Input type="number" min="0" step="0.01" value={data.valor_permuta} onChange={(e) => setData('valor_permuta', e.target.value)} />
                  </Field>
                )}
                <div className="md:col-span-2">
                  <Field label="Notas adicionales">
                    <Textarea rows={3} value={data.notas_adicionales} onChange={(e) => setData('notas_adicionales', e.target.value)} />
                  </Field>
                </div>
              </div>
            </StepCard>
          </div>

          {/* Resumen */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
              <div className="border-b border-gris-100 px-5 py-4">
                <h2 className="text-base font-bold text-gris-900">Resumen</h2>
                <p className="text-[13px] text-gris-500">Así queda la venta con tus cambios.</p>
              </div>
              <div className="space-y-4 p-5">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gris-500">{esServicio ? 'Precio del servicio' : 'Subtotal de productos'}</dt>
                    <dd className="font-semibold tabular-nums text-gris-900">{bsFmt(esServicio ? data.servicio_tecnico.precio_venta : subtotalProductos)}</dd>
                  </div>
                  {money(data.descuento) > 0 && (
                    <div className="flex justify-between gap-3"><dt className="text-gris-500">Descuento general</dt><dd className="font-semibold tabular-nums text-rose-600">−{bsFmt(data.descuento)}</dd></div>
                  )}
                  {!esServicio && money(data.valor_permuta) > 0 && (
                    <div className="flex justify-between gap-3"><dt className="text-gris-500">Permuta</dt><dd className="font-semibold tabular-nums text-rose-600">−{bsFmt(data.valor_permuta)}</dd></div>
                  )}
                  {!esServicio && reservaAplicada > 0 && (
                    <div className="flex justify-between gap-3"><dt className="text-gris-500">Abono de la reserva</dt><dd className="font-semibold tabular-nums text-rose-600">−{bsFmt(reservaAplicada)}</dd></div>
                  )}
                </dl>

                <div className="rounded-xl bg-carbon-900 px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Total a cobrar</p>
                  <p className="mt-1 text-[28px] font-bold leading-none tracking-tight">{bsFmt(total)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gris-200 px-3 py-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gris-400">Costo</p>
                    <p className="mt-1 text-[15px] font-bold tabular-nums text-gris-900">{bsFmt(capital)}</p>
                  </div>
                  <div className={`rounded-xl border px-3 py-2.5 ${ganancia < 0 ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gris-500">Ganancia</p>
                    <p className={`mt-1 text-[15px] font-bold tabular-nums ${ganancia < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {ganancia < 0 ? `−${bsFmt(Math.abs(ganancia))}` : bsFmt(ganancia)}
                    </p>
                  </div>
                </div>

                <button type="submit" disabled={processing} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  <Save className="h-4 w-4" /> {processing ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </form>
    </>
  );
}
