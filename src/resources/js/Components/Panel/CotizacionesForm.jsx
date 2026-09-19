import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import {
  ArrowLeft, Eye, FileText, Laptop, Mail, MessageCircle, Package, PencilLine, Search, Smartphone, Tablet, Trash2,
} from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Badge, Field, Input, Segmented, StepCard, Textarea, bsFmt, buttonCls } from '@/Components/Admin/ui';
import { calcularLinea, fmtTelefono, totalesDe } from '@/Components/Admin/cotizacion';

const TIPOS = [
  { value: 'celular', label: 'Celular', icon: Smartphone },
  { value: 'computadora', label: 'Computadora', icon: Laptop },
  { value: 'producto_apple', label: 'Equipo de marca', icon: Tablet },
  { value: 'producto_general', label: 'Producto general', icon: Package },
];
const etiquetaTipo = (t) => TIPOS.find((x) => x.value === t)?.label ?? 'Externo';

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const texto = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const correoValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400';

let ultimaClave = 0;
const nuevaClave = () => `f${++ultimaClave}`;

// Teléfono guardado del cliente → formato internacional, cuando se puede deducir
const aInternacional = (tel) => {
  const limpio = String(tel ?? '').replace(/[\s()-]/g, '');
  if (/^\+\d{8,15}$/.test(limpio)) return limpio;
  const d = limpio.replace(/\D/g, '');
  if (d.length === 8 && /^[67]/.test(d)) return `+591${d}`; // celular de Bolivia
  if (d.length === 11 && d.startsWith('591')) return `+${d}`;
  return undefined;
};

// Las mismas especificaciones que imprime el PDF debajo del nombre
const especificaciones = (i) => [
  i.modelo && normalizar(i.modelo) !== normalizar(i.nombre) ? i.modelo : null,
  i.procesador,
  i.ram && `RAM ${i.ram}`,
  i.almacenamiento,
  i.capacidad,
  i.color,
  i.bateria && `Batería ${i.bateria}`,
].filter(Boolean);

// Producto del inventario → línea de la cotización (mismos campos de siempre)
const aItem = (tipo, p) => ({
  nombre: p.modelo || p.nombre || '',
  tipo,
  modelo: texto(tipo === 'computadora' ? p.nombre : p.modelo),
  procesador: texto(p.procesador),
  ram: texto(p.ram),
  almacenamiento: texto(p.almacenamiento),
  capacidad: texto(p.capacidad),
  color: texto(p.color),
  bateria: texto(p.bateria),
});

const identificadorDe = (tipo, p) => {
  if (tipo === 'producto_general') return p.codigo ? `Código ${p.codigo}` : null;
  if (p.imei_1) return `IMEI …${String(p.imei_1).slice(-6)}`;
  return p.numero_serie ? `S/N ${p.numero_serie}` : null;
};

function Negritas({ texto: t }) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((parte, i) => (/^\*\*[^*]+\*\*$/.test(parte)
    ? <strong key={i} className="font-bold text-gris-900">{parte.slice(2, -2)}</strong>
    : <span key={i}>{parte}</span>));
}

// Vista previa aproximada de cómo el PDF muestra las notas (Markdown básico)
function NotasPrevia({ texto: t }) {
  const bloques = t.trim().split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="space-y-3 rounded-xl border border-gris-200 bg-gris-50/60 p-4 text-sm leading-relaxed text-gris-700">
      {bloques.map((b, i) => {
        const lineas = b.split('\n').filter((l) => l.trim());
        if (lineas.every((l) => /^\s*[*-]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lineas.map((l, j) => <li key={j}><Negritas texto={l.replace(/^\s*[*-]\s+/, '')} /></li>)}
            </ul>
          );
        }
        const unido = lineas.join(' ').trim();
        if (/^\*\*[^*]+\*\*$/.test(unido)) {
          return <p key={i} className="font-bold text-[#121214]">{unido.slice(2, -2)}</p>;
        }
        return <p key={i}><Negritas texto={unido} /></p>;
      })}
    </div>
  );
}

function Linea({ label, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gris-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-gris-900">{valor || '—'}</dd>
    </div>
  );
}

function Importe({ label, valor, className = 'text-gris-900', fuerte = false }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={fuerte ? 'font-semibold text-gris-700' : 'text-gris-500'}>{label}</dt>
      <dd className={`tabular-nums ${fuerte ? 'font-bold' : 'font-semibold'} ${className}`}>{valor}</dd>
    </div>
  );
}

export default function CotizacionesForm({
  celulares = [], computadoras = [], productosGenerales = [], productosApple = [], fechaHoy = '',
  Layout, prefijo = 'admin',
}) {
  const [cliente, setCliente] = useState({ nombre: '', correo: '', fecha: fechaHoy });
  const [telefono, setTelefono] = useState(undefined); // solo formato internacional (+591…)
  const [telefonoGuardado, setTelefonoGuardado] = useState('');
  const [items, setItems] = useState([]);
  const [notas, setNotas] = useState('');
  const [verPrevia, setVerPrevia] = useState(false);
  const [tipo, setTipo] = useState('celular');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [enfocar, setEnfocar] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [notice, setNotice] = useState(null);
  const ultimaBusqueda = useRef('');

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  // Quita errores por clave exacta o por prefijo («items.*»)
  const quitarErrores = (...claves) => setErrores((e) => {
    const resto = { ...e };
    let cambio = false;
    Object.keys(resto).forEach((k) => {
      if (claves.some((c) => (c.endsWith('.*') ? k.startsWith(c.slice(0, -1)) : k === c))) {
        delete resto[k];
        cambio = true;
      }
    });
    return cambio ? resto : e;
  });

  const cambiarCliente = (campo, valor, claveError) => {
    setCliente((c) => ({ ...c, [campo]: valor }));
    if (claveError) quitarErrores(claveError);
  };

  /* Cliente: sugerencias mientras escribe */
  const buscarCliente = async (valor) => {
    cambiarCliente('nombre', valor, 'nombre_cliente');
    ultimaBusqueda.current = valor;
    if (valor.trim().length < 2) {
      setMostrarSugerencias(false);
      return;
    }
    try {
      const res = await axios.get(route(`${prefijo}.clientes.sugerencias`), { params: { term: valor.trim() } });
      if (ultimaBusqueda.current !== valor) return; // respuesta vieja: ya escribió otra cosa
      setSugerencias(Array.isArray(res.data) ? res.data : []);
      setMostrarSugerencias(true);
    } catch {
      setMostrarSugerencias(false);
    }
  };

  const elegirCliente = (c) => {
    const internacional = aInternacional(c.telefono);
    setCliente((d) => ({ ...d, nombre: c.nombre, correo: c.correo || d.correo }));
    setTelefono(internacional);
    setTelefonoGuardado(internacional ? '' : String(c.telefono || ''));
    quitarErrores('nombre_cliente', 'telefono_completo', 'correo_cliente');
    setMostrarSugerencias(false);
  };

  /* Inventario: búsqueda por tipo */
  const fuentes = useMemo(() => ({
    celular: celulares,
    computadora: computadoras,
    producto_apple: productosApple,
    producto_general: productosGenerales,
  }), [celulares, computadoras, productosApple, productosGenerales]);

  const indice = useMemo(() => (fuentes[tipo] || []).map((p) => ({
    p,
    texto: normalizar([
      p.modelo, p.nombre, p.capacidad, p.color, p.procesador, p.ram, p.almacenamiento, p.codigo, p.imei_1, p.imei_2, p.numero_serie,
    ].filter(Boolean).join(' ')),
  })), [fuentes, tipo]);

  const resultados = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (!terminos.length) return [];
    return indice.filter((x) => terminos.every((t) => x.texto.includes(t))).slice(0, 8).map((x) => x.p);
  }, [indice, busqueda]);

  /* Líneas */
  const cambiarItem = (key, campo, valor) => {
    setItems((xs) => xs.map((i) => (i.key === key ? { ...i, [campo]: valor } : i)));
    quitarErrores(`fila.${key}`, 'items.*', 'items');
  };

  const quitarItem = (key) => {
    setItems((xs) => xs.filter((i) => i.key !== key));
    quitarErrores(`fila.${key}`, 'items.*');
  };

  const agregarDelInventario = (p) => {
    const origen = `${tipo}:${p.id}`;
    const existente = items.find((i) => i.origen === origen);
    setBusqueda('');
    setMostrarResultados(false);
    if (existente) {
      if (tipo !== 'producto_general') {
        avisar('Ya está en la cotización', 'Ese equipo ya fue agregado.', 'info');
        return;
      }
      cambiarItem(existente.key, 'cantidad', String((parseInt(existente.cantidad, 10) || 1) + 1));
      return;
    }
    setItems((xs) => [...xs, {
      key: nuevaClave(), origen, ...aItem(tipo, p), cantidad: '1', precio: String(Number(p.precio_venta || 0)), descuento: '',
    }]);
    quitarErrores('items');
  };

  const agregarExterno = () => {
    const key = nuevaClave();
    setItems((xs) => [...xs, {
      key, origen: null, nombre: '', tipo: null, modelo: null, procesador: null, ram: null, almacenamiento: null,
      capacidad: null, color: null, bateria: null, cantidad: '1', precio: '', descuento: '',
    }]);
    setEnfocar(key);
    quitarErrores('items');
  };

  const lineas = items.map((i) => ({
    ...i,
    calc: calcularLinea({ cantidad: i.cantidad, precio_sin_factura: i.precio, descuento: i.descuento }),
  }));
  const totales = totalesDe(items.map((i) => ({ cantidad: i.cantidad, precio_sin_factura: i.precio, descuento: i.descuento })));

  const errorDeFila = (i, idx) => errores[`fila.${i.key}`]
    || Object.entries(errores).find(([k]) => k.startsWith(`items.${idx}.`))?.[1];

  const validar = () => {
    const e = {};
    if (!cliente.nombre.trim()) e.nombre_cliente = 'Escribe el nombre del cliente o la empresa.';
    if (!telefono) e.telefono_completo = 'Escribe el número de WhatsApp del cliente.';
    else if (!/^\+\d{8,15}$/.test(telefono) || !isPossiblePhoneNumber(telefono)) e.telefono_completo = 'Revisa el número: parece incompleto.';
    if (cliente.correo.trim() && !correoValido(cliente.correo.trim())) e.correo_cliente = 'Revisa el correo.';
    if (!cliente.fecha) e.fecha_cotizacion = 'Elige la fecha.';
    if (items.length === 0) e.items = 'Agrega al menos un producto a la cotización.';
    items.forEach((i) => {
      const cant = Number(i.cantidad);
      const precio = Number(i.precio);
      const desc = Number(i.descuento || 0);
      let msg = null;
      if (!i.nombre.trim()) msg = 'Escribe la descripción del producto.';
      else if (!Number.isInteger(cant) || cant < 1) msg = 'La cantidad debe ser un número entero desde 1.';
      else if (!(precio > 0)) msg = 'Escribe el precio unitario.';
      else if (desc < 0) msg = 'El descuento no puede ser negativo.';
      else if (desc > precio * cant) msg = 'El descuento no puede ser mayor que el subtotal.';
      if (msg) e[`fila.${i.key}`] = msg;
    });
    return e;
  };

  const guardar = () => {
    if (guardando) return;
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    router.post(route(`${prefijo}.cotizaciones.store`), {
      nombre_cliente: cliente.nombre.trim(),
      telefono_completo: telefono,
      correo_cliente: cliente.correo.trim(),
      fecha_cotizacion: cliente.fecha,
      notas_adicionales: notas,
      items: lineas.map((i) => ({
        nombre: i.nombre.trim(),
        tipo: i.tipo,
        modelo: i.modelo,
        procesador: i.procesador,
        ram: i.ram,
        almacenamiento: i.almacenamiento,
        capacidad: i.capacidad,
        color: i.color,
        bateria: i.bateria,
        cantidad: i.calc.cantidad,
        precio_sin_factura: r2(i.precio),
        descuento: r2(i.calc.descuento),
        iva: i.calc.iva,
        it: i.calc.it,
        total: i.calc.total,
      })),
      total: r2(totales.conFactura),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(true),
      onSuccess: () => notifyRecordsUpdated(),
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo guardar la cotización', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(false),
    });
  };

  const mensajes = [...new Set(Object.values(errores).flat())];
  const correoOk = cliente.correo.trim() && correoValido(cliente.correo.trim());
  const etiqueta = etiquetaTipo(tipo);
  const disponibles = (fuentes[tipo] || []).length;

  return (
    <Layout title="Nueva cotización">
      <Head title="Nueva cotización" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route(`${prefijo}.cotizaciones.index`)} aria-label="Volver a cotizaciones"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-[#121214]" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Nueva cotización
            </h1>
            <p className="text-sm text-gris-500">Arma la propuesta para el cliente. Al guardar se genera el PDF con el total con y sin factura.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Paso 1 */}
            <StepCard step={1} title="Cliente" subtitle="Escribe el nombre: si ya te compró o cotizó antes, aparece para elegirlo.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Field label="Cliente o empresa" error={errores.nombre_cliente}>
                    <Input
                      value={cliente.nombre}
                      placeholder="Ej.: Centro Móvil"
                      autoComplete="off"
                      onChange={(e) => buscarCliente(e.target.value)}
                      onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
                    />
                  </Field>
                  {mostrarSugerencias && sugerencias.length > 0 && (
                    <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gris-200 bg-white text-sm shadow-xl">
                      {sugerencias.map((c) => (
                        <li key={c.id}>
                          <button type="button" className="block w-full px-4 py-2.5 text-left hover:bg-gris-50"
                            onMouseDown={(e) => e.preventDefault()} onClick={() => elegirCliente(c)}>
                            <span className="block font-semibold text-gris-900">{c.nombre}</span>
                            <span className="text-xs text-gris-500">{[c.telefono, c.correo].filter(Boolean).join(' · ')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Field label="WhatsApp" error={errores.telefono_completo}
                  hint={telefonoGuardado
                    ? `Tenía guardado ${telefonoGuardado}: escríbelo con el código de país.`
                    : 'Con código de país. A este número se comparte la cotización.'}>
                  <PhoneInput
                    flags={flags}
                    international
                    defaultCountry="BO"
                    value={telefono}
                    onChange={(v) => { setTelefono(v); setTelefonoGuardado(''); quitarErrores('telefono_completo'); }}
                    placeholder="+591 7XXXXXXX"
                    className={`flex h-11 items-center gap-2 rounded-xl border bg-white px-3 transition focus-within:border-[color:var(--acento)] focus-within:ring-4 focus-within:ring-[rgb(var(--acento-rgb)_/_0.15)] ${errores.telefono_completo ? 'border-rose-300' : 'border-gris-200'}`}
                    numberInputProps={{ className: 'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gris-900 placeholder:text-gris-400 focus:outline-none focus:ring-0' }}
                  />
                </Field>

                <Field label="Correo (opcional)" error={errores.correo_cliente} hint="Si lo escribes, al guardar se le envía el PDF.">
                  <Input type="email" value={cliente.correo} placeholder="Ej.: compras@empresa.com" autoComplete="off"
                    onChange={(e) => cambiarCliente('correo', e.target.value, 'correo_cliente')} />
                </Field>

                <Field label="Fecha de la cotización" error={errores.fecha_cotizacion} hint="Aparece en el PDF.">
                  <Input type="date" value={cliente.fecha} onChange={(e) => cambiarCliente('fecha', e.target.value, 'fecha_cotizacion')} />
                </Field>
              </div>
            </StepCard>

            {/* Paso 2 */}
            <StepCard step={2} title="Productos"
              subtitle="Busca en el inventario o agrega uno externo. Los precios van sin factura: el IVA y el IT se calculan solos."
              actions={<Badge tone="navy">{items.length} {items.length === 1 ? 'producto' : 'productos'}</Badge>}>
              <Segmented options={TIPOS} value={tipo} ariaLabel="Tipo de producto"
                onChange={(v) => { setTipo(v); setBusqueda(''); setMostrarResultados(false); }} />

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
                <Input
                  className="pl-10"
                  value={busqueda}
                  placeholder={`Buscar ${etiqueta.toLowerCase()} por modelo, capacidad, color, IMEI, serie o código`}
                  onChange={(e) => { setBusqueda(e.target.value); setMostrarResultados(true); }}
                  onFocus={() => setMostrarResultados(true)}
                  onBlur={() => setTimeout(() => setMostrarResultados(false), 150)}
                />
                {mostrarResultados && busqueda.trim() && (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-gris-200 bg-white shadow-xl">
                    {resultados.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-gris-500">Nada coincide en {etiqueta.toLowerCase()} disponibles.</li>
                    ) : resultados.map((p) => {
                      const detalle = [...especificaciones(aItem(tipo, p)), identificadorDe(tipo, p)].filter(Boolean).join(' · ');
                      return (
                        <li key={p.id}>
                          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => agregarDelInventario(p)}
                            className="flex w-full items-center justify-between gap-3 border-b border-gris-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gris-50">
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-gris-900">{p.modelo || p.nombre}</span>
                              {detalle && <span className="block truncate text-xs text-gris-500">{detalle}</span>}
                            </span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-gris-900">{bsFmt(p.precio_venta)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-gris-500">
                <span>{disponibles.toLocaleString('es-BO')} disponibles en {etiqueta.toLowerCase()}</span>
                <button type="button" onClick={agregarExterno}
                  className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--acento)] transition-colors hover:text-[#121214]">
                  <PencilLine className="h-3.5 w-3.5" /> Agregar producto externo
                </button>
              </div>

              <div className="mt-5">
                {lineas.length === 0 ? (
                  <div className={`rounded-xl border border-dashed px-4 py-8 text-center text-sm ${errores.items ? 'border-rose-300 bg-rose-50/40 font-semibold text-rose-600' : 'border-gris-200 bg-gris-50/60 text-gris-500'}`}>
                    {errores.items || 'Todavía no agregaste productos. Búscalos arriba o agrega uno externo.'}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {lineas.map((i, idx) => {
                      const error = errorDeFila(i, idx);
                      const specs = especificaciones(i);
                      return (
                        <li key={i.key} className={`rounded-xl border p-4 transition-colors ${error ? 'border-rose-300 bg-rose-50/30' : 'border-gris-200 bg-white'}`}>
                          <div className="flex items-start gap-3">
                            <span className="mt-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gris-100 text-xs font-bold text-gris-500">{idx + 1}</span>
                            <div className="min-w-0 flex-1">
                              <Input value={i.nombre} autoFocus={enfocar === i.key} aria-label={`Descripción del producto ${idx + 1}`}
                                placeholder="Descripción del producto" onChange={(e) => cambiarItem(i.key, 'nombre', e.target.value)} />
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gris-500">
                                <Badge tone={i.tipo ? 'lila' : 'slate'}>{i.tipo ? etiquetaTipo(i.tipo) : 'Externo'}</Badge>
                                {specs.length > 0 && <span className="min-w-0">{specs.join(' · ')}</span>}
                              </div>
                            </div>
                            <button type="button" onClick={() => quitarItem(i.key)} aria-label={`Quitar ${i.nombre || `producto ${idx + 1}`}`} title="Quitar"
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:pl-11">
                            <label className="block">
                              <span className={labelCls}>Cantidad</span>
                              <Input type="number" min="1" step="1" inputMode="numeric" className="mt-1 text-right tabular-nums"
                                value={i.cantidad} onChange={(e) => cambiarItem(i.key, 'cantidad', e.target.value)} />
                            </label>
                            <label className="block">
                              <span className={labelCls}>Precio unitario</span>
                              <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" className="mt-1 text-right tabular-nums"
                                value={i.precio} onChange={(e) => cambiarItem(i.key, 'precio', e.target.value)} />
                            </label>
                            <label className="block">
                              <span className={labelCls}>Descuento</span>
                              <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" className="mt-1 text-right tabular-nums"
                                value={i.descuento} onChange={(e) => cambiarItem(i.key, 'descuento', e.target.value)} />
                            </label>
                            <div className="text-right">
                              <span className={labelCls}>Con factura</span>
                              <p className="mt-1 text-lg font-extrabold leading-tight tabular-nums text-gris-900">{bsFmt(i.calc.total)}</p>
                              <p className="text-[11px] tabular-nums text-gris-400">Sin factura {bsFmt(i.calc.neto)}</p>
                            </div>
                          </div>
                          {error && <p className="mt-2 text-xs font-semibold text-rose-600 sm:pl-11">{error}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </StepCard>

            {/* Paso 3 */}
            <StepCard step={3} title="Condiciones y notas" subtitle="Opcional. Van al final del PDF tal como las escribas."
              actions={notas.trim() && (
                <button type="button" onClick={() => setVerPrevia((v) => !v)} className={buttonCls('ghost', 'h-9 px-3 text-xs')}>
                  {verPrevia ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {verPrevia ? 'Editar' : 'Vista previa'}
                </button>
              )}>
              {verPrevia && notas.trim() ? (
                <NotasPrevia texto={notas} />
              ) : (
                <Textarea rows={8} value={notas} onChange={(e) => setNotas(e.target.value)}
                  placeholder={'**Condiciones de la cotización**\n\nEscribe aquí las condiciones acordadas con el cliente.'} />
              )}
              <p className="mt-2 text-[11px] leading-snug text-gris-500">
                Usa **texto** para títulos y negritas, empieza la línea con * para una lista y deja una línea en blanco entre párrafos.
              </p>
            </StepCard>
          </div>

          {/* Resumen */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <FileText className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen
                </h2>
                <Badge tone="navy">{items.length} {items.length === 1 ? 'producto' : 'productos'}</Badge>
              </div>

              <div className="space-y-4 p-5">
                <dl className="space-y-1.5 text-sm">
                  <Linea label="Cliente" valor={cliente.nombre.trim()} />
                  <Linea label="WhatsApp" valor={telefono ? fmtTelefono(telefono) : ''} />
                  <Linea label="Correo" valor={cliente.correo.trim()} />
                </dl>

                <dl className="space-y-1.5 border-t border-gris-100 pt-4 text-sm">
                  <Importe label="Subtotal sin factura" valor={bsFmt(totales.subtotal)} />
                  <Importe label="Descuentos" valor={totales.descuentos > 0 ? `−${bsFmt(totales.descuentos)}` : bsFmt(0)}
                    className={totales.descuentos > 0 ? 'text-rose-600' : 'text-gris-900'} />
                  <Importe label="Importe neto sin factura" valor={bsFmt(totales.sinFactura)} fuerte />
                  <Importe label="IVA 13 %" valor={bsFmt(totales.iva)} />
                  <Importe label="IT 3 %" valor={bsFmt(totales.it)} />
                </dl>

                <div className="rounded-xl bg-[#121214] px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Importe neto con factura</p>
                  <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{bsFmt(totales.conFactura)}</p>
                  <p className="mt-1.5 text-xs text-white/60">Es el total que ve el cliente en el PDF.</p>
                </div>

                {mensajes.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <p className="mb-1 font-semibold">Revisa estos datos:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {mensajes.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                )}

                <button type="button" onClick={guardar} disabled={guardando} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  {guardando ? 'Guardando y generando el PDF…' : 'Guardar cotización'}
                </button>
                <p className="flex items-start justify-center gap-1.5 text-center text-xs text-gris-400">
                  {correoOk ? (
                    <><Mail className="mt-px h-3.5 w-3.5 shrink-0" /> Se genera el PDF y se envía a {cliente.correo.trim()}.</>
                  ) : (
                    <><MessageCircle className="mt-px h-3.5 w-3.5 shrink-0" /> Se genera el PDF; desde el listado lo compartes por WhatsApp.</>
                  )}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
