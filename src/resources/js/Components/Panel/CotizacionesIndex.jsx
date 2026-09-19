import { Head, Link, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  CalendarRange, FileText, Mail, MessageCircle, Plus, Receipt, Search, Send, TrendingUp, Wallet, X,
} from 'lucide-react';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';
import {
  Badge, Button, EmptyState, Modal, PageHeader, Toast, bsFmt, buttonCls, inputCls, useToast,
} from '@/Components/Admin/ui';
import { fmtTelefono, numeroCotizacion, totalesDe } from '@/Components/Admin/cotizacion';

const TZ = 'America/La_Paz';
const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const diaLocal = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
const fechaCorta = (iso) => (iso
  ? new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
  : '—');
const whatsappValido = (tel) => String(tel ?? '').replace(/\D/g, '').length >= 8;
const nombreItem = (item) => item?.nombre || item?.modelo || 'Producto';
const checkCls = 'h-4 w-4 cursor-pointer rounded border-gris-300 text-[#121214] focus:ring-2 focus:ring-[rgb(var(--acento-rgb)_/_0.3)] focus:ring-offset-0';

const PERIODOS = [
  { key: 'todo', label: 'Todo' },
  { key: 'mes', label: 'Este mes' },
  { key: '30d', label: '30 días' },
  { key: 'anio', label: 'Este año' },
];

function rangoDe(periodo) {
  const hoy = dayjs();
  if (periodo === 'mes') return [hoy.startOf('month'), hoy.endOf('month')];
  if (periodo === '30d') return [hoy.subtract(29, 'day'), hoy];
  if (periodo === 'anio') return [hoy.startOf('year'), hoy.endOf('year')];
  return null;
}

function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-[#121214]/[0.07] text-[#121214]',
    lila: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 text-[24px] font-extrabold leading-none tracking-tight text-gris-900">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

function Chips({ label, icon: Icon, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-gris-400">
        <Icon className="h-4 w-4 text-[color:var(--acento)]" /> {label}
      </span>
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${value === o.key ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
          {o.label}
          {o.n !== undefined && <span className={value === o.key ? 'text-white/70' : 'text-gris-400'}>{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

function EnvioEstado({ c }) {
  return (
    <div className="flex flex-wrap gap-1">
      {c.enviado_por_correo && <Badge tone="blue"><Mail className="h-3 w-3" /> Correo</Badge>}
      {c.enviado_por_whatsapp && (
        <span title="Se abrió WhatsApp con el mensaje listo"><Badge tone="emerald"><MessageCircle className="h-3 w-3" /> WhatsApp</Badge></span>
      )}
      {!c.enviado_por_correo && !c.enviado_por_whatsapp && <Badge tone="slate">Sin enviar</Badge>}
      {!c.drive_url && (
        <span title="El PDF no se subió a Drive: el enlace solo abre con sesión iniciada."><Badge tone="amber">PDF solo interno</Badge></span>
      )}
    </div>
  );
}

function Acciones({ c, onReenviar, prefijo }) {
  const pdf = c.drive_url || route(`${prefijo}.cotizaciones.pdf`, c.id);
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <a href={pdf} target="_blank" rel="noopener noreferrer" title="Ver el PDF que recibe el cliente"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 transition-colors hover:border-gris-300 hover:text-gris-900">
        <FileText className="h-3.5 w-3.5" /> PDF
      </a>
      {whatsappValido(c.telefono) ? (
        <a href={route(`${prefijo}.cotizaciones.enviar-whatsapp-libre`, { id: c.id })} target="_blank" rel="noopener noreferrer"
          title="Abrir WhatsApp con el mensaje listo"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700">
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
      ) : (
        <span title="La cotización no tiene número de WhatsApp"
          className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg bg-gris-100 px-2.5 text-xs font-bold text-gris-400">
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </span>
      )}
      {c.correo_cliente && (
        <button type="button" onClick={() => onReenviar(c)} title={`Reenviar a ${c.correo_cliente}`} aria-label={`Reenviar ${numeroCotizacion(c.id)} por correo`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-gris-200 bg-white text-gris-600 transition-colors hover:border-[#121214] hover:bg-[#121214] hover:text-white">
          <Mail className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function CotizacionesIndex({ cotizaciones = [], Layout, prefijo = 'admin', titulo, subtitulo, guia = null }) {
  useAutoRefresh(['cotizaciones']);
  const [toast, show] = useToast();

  const [texto, setTexto] = useState('');
  const [periodo, setPeriodo] = useState('todo');
  const [envio, setEnvio] = useState('todas');
  const [creador, setCreador] = useState('todos');
  const [limite, setLimite] = useState(50);
  const [seleccion, setSeleccion] = useState([]);
  const [reenviar, setReenviar] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const filas = useMemo(() => cotizaciones.map((c) => {
    const items = Array.isArray(c.items) ? c.items : [];
    const t = totalesDe(items);
    return {
      ...c,
      items,
      conFactura: t.conFactura,
      sinFactura: t.sinFactura,
      unidades: t.unidades,
      dia: diaLocal(c.fecha_cotizacion || c.created_at),
    };
  }), [cotizaciones]);

  const creadores = useMemo(() => [...new Set(filas.map((c) => c.usuario?.name).filter(Boolean))].sort(), [filas]);
  const conteoEnvio = useMemo(() => ({
    todas: filas.length,
    correo: filas.filter((c) => c.enviado_por_correo).length,
    whatsapp: filas.filter((c) => c.enviado_por_whatsapp).length,
    sin: filas.filter((c) => !c.enviado_por_correo && !c.enviado_por_whatsapp).length,
  }), [filas]);

  const rango = rangoDe(periodo);
  const [desde, hasta] = rango ? rango.map((d) => d.format('YYYY-MM-DD')) : ['', ''];
  const q = normalizar(texto.trim());

  const filtradas = useMemo(() => filas.filter((c) =>
    (!desde || (c.dia >= desde && c.dia <= hasta))
    && (envio === 'todas'
      || (envio === 'correo' && c.enviado_por_correo)
      || (envio === 'whatsapp' && c.enviado_por_whatsapp)
      || (envio === 'sin' && !c.enviado_por_correo && !c.enviado_por_whatsapp))
    && (creador === 'todos' || c.usuario?.name === creador)
    && (!q || normalizar([
      c.nombre_cliente, c.telefono, c.correo_cliente, numeroCotizacion(c.id), c.usuario?.name, ...c.items.map(nombreItem),
    ].join(' ')).includes(q)),
  ), [filas, desde, hasta, envio, creador, q]);

  useEffect(() => { setLimite(50); }, [q, periodo, envio, creador]);

  const visibles = filtradas.slice(0, limite);
  const seleccionadas = filtradas.filter((c) => seleccion.includes(c.id));
  const todasMarcadas = filtradas.length > 0 && filtradas.every((c) => seleccion.includes(c.id));
  const alternar = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const alternarTodas = () => setSeleccion(todasMarcadas ? [] : filtradas.map((c) => c.id));

  const totalCon = filtradas.reduce((a, c) => a + c.conFactura, 0);
  const totalSin = filtradas.reduce((a, c) => a + c.sinFactura, 0);
  const unidades = filtradas.reduce((a, c) => a + c.unidades, 0);
  const promedio = filtradas.length ? totalCon / filtradas.length : 0;
  const porCorreo = filtradas.filter((c) => c.enviado_por_correo).length;
  const porWhatsapp = filtradas.filter((c) => c.enviado_por_whatsapp).length;
  const enviadas = filtradas.filter((c) => c.enviado_por_correo || c.enviado_por_whatsapp).length;
  const totalSeleccion = seleccionadas.reduce((a, c) => a + c.conFactura, 0);
  const hayFiltros = Boolean(q) || periodo !== 'todo' || envio !== 'todas' || creador !== 'todos';
  const limpiar = () => { setTexto(''); setPeriodo('todo'); setEnvio('todas'); setCreador('todos'); };

  const enviarLote = () => {
    const ids = seleccionadas.map((c) => c.id);
    if (ids.length) router.post(route(`${prefijo}.cotizaciones.enviar-lote`), { ids });
  };

  const confirmarReenvio = () => {
    if (!reenviar) return;
    router.post(route(`${prefijo}.cotizaciones.reenviar`, reenviar.id), {}, {
      preserveScroll: true,
      onStart: () => setProcesando(true),
      onError: () => show('No se pudo reenviar el correo.', 'error'),
      onFinish: () => { setProcesando(false); setReenviar(null); },
    });
  };

  return (
    <Layout title="Cotizaciones">
      <Head title="Cotizaciones" />
      <Toast toast={toast} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title={titulo ?? 'Cotizaciones'}
          subtitle={subtitulo ?? 'Propuestas de precio para clientes. Desde aquí ves el PDF, lo compartes por WhatsApp o lo reenvías por correo.'}
          actions={
            <Link href={route(`${prefijo}.cotizaciones.create`)} className={buttonCls('primary', 'h-11 px-5')}>
              <Plus className="h-4 w-4" /> Nueva cotización
            </Link>
          }
        />

        {guia}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Receipt} label="Cotizaciones" value={filtradas.length.toLocaleString('es-BO')}
            hint={`${unidades.toLocaleString('es-BO')} ${unidades === 1 ? 'unidad cotizada' : 'unidades cotizadas'}`} />
          <Stat icon={Wallet} label="Total con factura" value={bsFmt(totalCon)} hint={`Sin factura: ${bsFmt(totalSin)}`} tone="lila" />
          <Stat icon={TrendingUp} label="Promedio por cotización" value={bsFmt(promedio)} hint="Con factura" tone="amber" />
          <Stat icon={Send} label="Enviadas" value={enviadas.toLocaleString('es-BO')} hint={`${porCorreo} por correo · ${porWhatsapp} por WhatsApp`} tone="emerald" />
        </div>

        {/* Búsqueda y filtros */}
        <section className="rounded-2xl border border-gris-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar cotizaciones"
                placeholder="Buscar por cliente, número (COT-…), teléfono, correo o producto"
                className={`${inputCls} h-11 pl-10 pr-10`} />
              {texto && (
                <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {creadores.length > 1 && (
              <select value={creador} onChange={(e) => setCreador(e.target.value)} aria-label="Creada por"
                className={`${inputCls} h-11 pr-9 lg:w-56`}>
                <option value="todos">Creada por: todos</option>
                {creadores.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3 border-t border-gris-100 pt-3 xl:flex-row xl:items-center xl:justify-between">
            <Chips label="Período" icon={CalendarRange} options={PERIODOS} value={periodo} onChange={setPeriodo} />
            <Chips label="Envío" icon={Send} value={envio} onChange={setEnvio} options={[
              { key: 'todas', label: 'Todas', n: conteoEnvio.todas },
              { key: 'correo', label: 'Por correo', n: conteoEnvio.correo },
              { key: 'whatsapp', label: 'Por WhatsApp', n: conteoEnvio.whatsapp },
              { key: 'sin', label: 'Sin enviar', n: conteoEnvio.sin },
            ]} />
          </div>
        </section>

        {/* Listado */}
        <section className="overflow-hidden rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
              <Receipt className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Detalle de cotizaciones
            </h2>
            <div className="flex items-center gap-2">
              {filtradas.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gris-600 md:hidden">
                  <input type="checkbox" checked={todasMarcadas} onChange={alternarTodas} className={checkCls} /> Todas
                </label>
              )}
              {hayFiltros && (
                <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                  <X className="h-3.5 w-3.5" /> Quitar filtros
                </button>
              )}
            </div>
          </div>

          {cotizaciones.length === 0 ? (
            <EmptyState icon={Receipt} title="Todavía no hay cotizaciones"
              text="Arma la primera: al guardarla se genera el PDF para compartir con el cliente."
              action={<Link href={route(`${prefijo}.cotizaciones.create`)} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Crear una cotización</Link>} />
          ) : filtradas.length === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro nombre o número, o quita los filtros."
              action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
          ) : (
            <>
              {/* Escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1120px] text-[13px]">
                  <thead>
                    <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                      <th className="w-10 py-3 pl-5 pr-2">
                        <input type="checkbox" checked={todasMarcadas} onChange={alternarTodas} aria-label="Seleccionar todas" className={checkCls} />
                      </th>
                      <th className="px-3 py-3">Cotización</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Productos</th>
                      <th className="px-4 py-3 text-right">Con factura</th>
                      <th className="px-4 py-3 text-right">Sin factura</th>
                      <th className="px-4 py-3">Envío</th>
                      <th className="px-5 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {visibles.map((c) => {
                      const marcada = seleccion.includes(c.id);
                      return (
                        <tr key={c.id} className={`align-top transition-colors ${marcada ? 'bg-[rgb(var(--acento-rgb)_/_0.06)]' : 'hover:bg-gris-50/70'}`}>
                          <td className="py-3 pl-5 pr-2">
                            <input type="checkbox" checked={marcada} onChange={() => alternar(c.id)} aria-label={`Seleccionar ${numeroCotizacion(c.id)}`} className={checkCls} />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-mono text-[13px] font-bold text-[color:var(--acento)]">{numeroCotizacion(c.id)}</p>
                            <p className="mt-0.5 whitespace-nowrap text-xs text-gris-400">
                              {fechaCorta(c.fecha_cotizacion || c.created_at)}
                              {creadores.length > 1 && c.usuario?.name ? ` · ${c.usuario.name}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[220px] truncate font-semibold text-gris-900">{c.nombre_cliente}</p>
                            <p className="mt-0.5 max-w-[220px] truncate text-xs text-gris-400">
                              {[fmtTelefono(c.telefono), c.correo_cliente].filter(Boolean).join(' · ') || 'Sin contacto'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[260px] truncate font-medium text-gris-800" title={c.items.map(nombreItem).join(' · ')}>
                              {c.items[0] ? nombreItem(c.items[0]) : '—'}
                            </p>
                            <p className="mt-0.5 text-xs text-gris-400">
                              {c.items.length > 1 ? `y ${c.items.length - 1} más · ` : ''}{c.unidades} {c.unidades === 1 ? 'unidad' : 'unidades'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-gris-900">{bsFmt(c.conFactura)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gris-500">{bsFmt(c.sinFactura)}</td>
                          <td className="px-4 py-3"><EnvioEstado c={c} /></td>
                          <td className="px-5 py-3"><Acciones c={c} onReenviar={setReenviar} prefijo={prefijo} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gris-200 bg-gris-50/70 text-[13px]">
                      <td className="px-5 py-3 font-bold text-gris-900" colSpan={4}>
                        Total {hayFiltros ? 'filtrado' : 'general'} · {filtradas.length.toLocaleString('es-BO')} {filtradas.length === 1 ? 'cotización' : 'cotizaciones'}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-gris-900">{bsFmt(totalCon)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-gris-600">{bsFmt(totalSin)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Celular */}
              <ul className="divide-y divide-gris-100 md:hidden">
                {visibles.map((c) => {
                  const marcada = seleccion.includes(c.id);
                  return (
                    <li key={c.id} className={`space-y-3 px-4 py-4 ${marcada ? 'bg-[rgb(var(--acento-rgb)_/_0.06)]' : ''}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={marcada} onChange={() => alternar(c.id)} aria-label={`Seleccionar ${numeroCotizacion(c.id)}`} className={`${checkCls} mt-1`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-gris-900">{c.nombre_cliente}</p>
                          <p className="font-mono text-xs font-bold text-[color:var(--acento)]">
                            {numeroCotizacion(c.id)} <span className="font-sans font-normal text-gris-400">· {fechaCorta(c.fecha_cotizacion || c.created_at)}</span>
                          </p>
                        </div>
                        <EnvioEstado c={c} />
                      </div>
                      <p className="truncate text-sm text-gris-600">
                        {c.items[0] ? nombreItem(c.items[0]) : '—'}
                        {c.items.length > 1 && <span className="text-gris-400"> y {c.items.length - 1} más</span>}
                      </p>
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-gris-50 p-3 text-center">
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Con factura</p><p className="text-sm font-bold tabular-nums text-gris-900">{bsFmt(c.conFactura)}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Sin factura</p><p className="text-sm font-semibold tabular-nums text-gris-600">{bsFmt(c.sinFactura)}</p></div>
                      </div>
                      <Acciones c={c} onReenviar={setReenviar} prefijo={prefijo} />
                    </li>
                  );
                })}
              </ul>

              {filtradas.length > limite && (
                <div className="border-t border-gris-100 px-5 py-3 text-center">
                  <button type="button" onClick={() => setLimite((l) => l + 50)} className={buttonCls('secondary')}>
                    Mostrar 50 más <span className="text-gris-400">({(filtradas.length - limite).toLocaleString('es-BO')} restantes)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Acciones con las marcadas */}
        {seleccionadas.length > 0 && (
          <div className="sticky bottom-4 z-30">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[#121214] px-5 py-3 text-white shadow-[0_18px_40px_-18px_rgba(10, 10, 11,0.8)]">
              <p className="text-sm font-bold">
                {seleccionadas.length} {seleccionadas.length === 1 ? 'seleccionada' : 'seleccionadas'}
              </p>
              <p className="text-sm text-white/70">
                Con factura <span className="font-semibold tabular-nums text-white">{bsFmt(totalSeleccion)}</span>
              </p>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setSeleccion([])}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                  Quitar selección
                </button>
                <button type="button" onClick={enviarLote}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600">
                  <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {reenviar && (
        <Modal
          title="Reenviar por correo"
          onClose={() => !procesando && setReenviar(null)}
          footer={
            <>
              <Button onClick={() => setReenviar(null)} disabled={procesando}>Volver</Button>
              <Button variant="primary" onClick={confirmarReenvio} disabled={procesando}>
                <Mail className="h-4 w-4" /> {procesando ? 'Enviando…' : 'Sí, reenviar'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gris-600">Se vuelve a enviar el PDF de la cotización a este correo:</p>
          <div className="mt-4 rounded-xl border border-gris-200 bg-gris-50 px-4 py-3 text-sm">
            <p className="font-semibold text-gris-900">
              {reenviar.nombre_cliente} <span className="font-mono text-[color:var(--acento)]">· {numeroCotizacion(reenviar.id)}</span>
            </p>
            <p className="mt-0.5 text-gris-500">{reenviar.correo_cliente}</p>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
