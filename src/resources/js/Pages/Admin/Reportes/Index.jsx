import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  AlertTriangle, BadgePercent, CalendarRange, Download, FileText, PiggyBank, Search, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import AllocationDonut, { CATEGORIAS } from '@/Components/Admin/charts/AllocationDonut';
import { EmptyState, PageHeader, Paginador, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';

const TZ = 'America/La_Paz';
const COLOR = Object.fromEntries(CATEGORIAS.map((c) => [c.label, c.color]));

// Tipos tal como vienen del servidor, con el mismo color que el gráfico
const TIPOS = [
  { key: 'Celular', label: 'Celulares', color: COLOR.Celulares },
  { key: 'Computadora', label: 'Computadoras', color: COLOR.Computadoras },
  { key: 'Producto General', label: 'Productos generales', color: COLOR['Productos Generales'] },
  { key: 'Producto Apple', label: 'Equipos de marca', color: COLOR['Productos Apple'] },
  { key: 'Servicio Técnico', label: 'Servicio técnico', color: COLOR['Servicios Técnicos'] },
];

const fechaCorta = (iso) => (iso
  ? new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
  : '—');
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '');
// «2026-09-01» → «1 sept 2026», sin desfase por zona horaria
const fechaTexto = (ymd, conAnio = true) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', ...(conAnio && { year: 'numeric' }) });
};
const conSigno = (n) => (n < 0 ? `−${bsFmt(Math.abs(n))}` : `+${bsFmt(n)}`);
const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Mientras se escribe el año, el campo pasa por fechas como 0002-09-01: solo cuentan las completas
const fechaValida = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000);
const problemaDe = (x) => {
  if (x.desde && !x.hasta) return 'Elige también la fecha final.';
  if (!x.desde && x.hasta) return 'Elige también la fecha inicial.';
  if (x.desde && x.hasta && x.desde > x.hasta) return 'La fecha inicial no puede ser posterior a la final.';
  return null;
};

const fechaCls = 'h-9 w-full min-w-0 border-0 bg-transparent p-0 text-sm text-gris-800 shadow-none focus:outline-none focus:ring-0 sm:w-[128px]';

function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-[#121214]/[0.07] text-[#121214]',
    emerald: 'bg-emerald-50 text-emerald-700',
    lila: 'bg-[#96684F]/10 text-[#96684F]',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 truncate text-[24px] font-extrabold leading-none tracking-tight text-gris-900">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

function TipoEtiqueta({ tipo }) {
  const t = TIPOS.find((x) => x.key === tipo);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gris-100 px-2 py-0.5 text-[11px] font-bold text-gris-700">
      <span className="h-2 w-2 rounded-full" style={{ background: t?.color ?? '#94A3B8' }} /> {t?.label ?? tipo}
    </span>
  );
}

function Ganancia({ valor }) {
  if (valor < 0) {
    return (
      <span className="inline-flex flex-col items-end">
        <span className="font-bold text-rose-600">{conSigno(valor)}</span>
        <span className="text-[11px] text-gris-400">Se invirtió</span>
      </span>
    );
  }
  return <span className="font-bold text-emerald-700">{conSigno(valor)}</span>;
}

function PorVendedor({ filas = [] }) {
  const vendidoTotal = filas.reduce((a, v) => a + Number(v.vendido || 0), 0);
  return (
    <section className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#96684F]/10 text-[#96684F]"><Users className="h-5 w-5" /></span>
          <div>
            <p className="text-base font-bold text-gris-900">Rendimiento por vendedor</p>
            <p className="text-[13px] text-gris-500">Lo vendido y lo ganado por cada persona</p>
          </div>
        </div>
        <span className="rounded-lg bg-gris-100 px-2 py-1 text-xs font-bold text-gris-600">
          {filas.length} {filas.length === 1 ? 'persona' : 'personas'}
        </span>
      </div>

      {filas.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gris-200 bg-gris-50/60 px-6 py-12 text-center text-sm text-gris-500">
          Sin ventas ni servicios en este período.
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {filas.map((v) => {
            const parte = vendidoTotal > 0 ? Number(v.vendido) / vendidoTotal : 0;
            return (
              <li key={v.nombre} className="rounded-xl border border-gris-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#121214] text-xs font-bold text-white">{iniciales(v.nombre)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gris-900">{v.nombre}</p>
                    <p className="text-xs text-gris-500">{Number(v.movimientos).toLocaleString('es-BO')} {Number(v.movimientos) === 1 ? 'movimiento' : 'movimientos'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold tabular-nums text-gris-900">{bsFmt(v.vendido)}</p>
                    <p className={`text-xs font-semibold tabular-nums ${Number(v.ganancia) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {conSigno(Number(v.ganancia))} de ganancia
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gris-100">
                    <div className="h-full rounded-full bg-[#96684F]" style={{ width: `${parte * 100}%` }} />
                  </div>
                  <span className="w-10 text-right text-[11px] font-bold tabular-nums text-gris-500">{Math.round(parte * 100)} %</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function ReporteIndex({
  ventas = { data: [] },
  totales_vista: totalesVista = {},
  conteo_tipos: conteoTipos = {},
  resumen = {},
  serie = { puntos: [] },
  por_vendedor: porVendedor = [],
  filtros = {},
  vendedores = [],
}) {
  const { errors = {} } = usePage().props;

  const hoy = dayjs().format('YYYY-MM-DD');
  const pasado = dayjs().subtract(1, 'month');
  const periodos = [
    { key: 'todo', label: 'Todo', desde: '', hasta: '' },
    { key: 'hoy', label: 'Hoy', desde: hoy, hasta: hoy },
    { key: '7d', label: '7 días', desde: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), hasta: hoy },
    { key: 'mes', label: 'Este mes', desde: dayjs().startOf('month').format('YYYY-MM-DD'), hasta: hoy },
    { key: 'pasado', label: 'Mes pasado', desde: pasado.startOf('month').format('YYYY-MM-DD'), hasta: pasado.endOf('month').format('YYYY-MM-DD') },
    { key: 'anio', label: 'Este año', desde: dayjs().startOf('year').format('YYYY-MM-DD'), hasta: hoy },
  ];

  const [f, setF] = useState({
    desde: filtros.fecha_inicio || '',
    hasta: filtros.fecha_fin || '',
    vendedor: filtros.vendedor_id ? String(filtros.vendedor_id) : '',
    tipo: filtros.tipo || '',
    buscar: filtros.buscar || '',
    porPagina: Number(filtros.por_pagina) || 25,
  });
  const [cargando, setCargando] = useState(false);
  const [cargandoTabla, setCargandoTabla] = useState(false);
  const espera = useRef(null);
  const tablaRef = useRef(null);
  useEffect(() => () => clearTimeout(espera.current), []);

  const params = (x, pagina = 1) => Object.fromEntries(Object.entries({
    fecha_inicio: x.desde,
    fecha_fin: x.hasta,
    vendedor_id: x.vendedor,
    tipo: x.tipo,
    buscar: x.buscar.trim(),
    por_pagina: x.porPagina !== 25 ? x.porPagina : '',
    page: pagina > 1 ? pagina : '',
  }).filter(([, v]) => v !== '' && v !== null && v !== undefined));

  // Período o vendedor: se recalcula todo el reporte
  const aplicarTodo = (x) => {
    clearTimeout(espera.current);
    router.get(route('admin.reportes.index'), params(x), {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onStart: () => setCargando(true),
      onFinish: () => setCargando(false),
    });
  };

  // Tipo, búsqueda, filas o página: solo cambia la tabla
  const aplicarTabla = (x, pagina = 1, subir = false) => {
    clearTimeout(espera.current);
    router.get(route('admin.reportes.index'), params(x, pagina), {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      only: ['ventas', 'totales_vista', 'filtros'],
      onStart: () => setCargandoTabla(true),
      onFinish: () => setCargandoTabla(false),
      onSuccess: () => { if (subir) tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    });
  };

  const cambiarPeriodo = (cambios, esperar = false) => {
    const x = { ...f, ...cambios };
    setF(x);
    clearTimeout(espera.current);
    if (!fechaValida(x.desde) || !fechaValida(x.hasta) || problemaDe(x)) return;
    if (esperar) espera.current = setTimeout(() => aplicarTodo(x), 450);
    else aplicarTodo(x);
  };
  const cambiarVendedor = (vendedor) => {
    const x = { ...f, vendedor };
    setF(x);
    if (!problemaDe(x)) aplicarTodo(x);
  };
  const cambiarTipo = (tipo) => {
    const x = { ...f, tipo };
    setF(x);
    aplicarTabla(x);
  };
  const cambiarBusqueda = (buscar) => {
    const x = { ...f, buscar };
    setF(x);
    clearTimeout(espera.current);
    if (!buscar) aplicarTabla(x);
    else espera.current = setTimeout(() => aplicarTabla(x), 400);
  };
  const cambiarPorPagina = (porPagina) => {
    const x = { ...f, porPagina };
    setF(x);
    aplicarTabla(x);
  };
  const irAPagina = (pagina) => aplicarTabla(f, pagina, true);
  const limpiarTabla = () => {
    const x = { ...f, tipo: '', buscar: '' };
    setF(x);
    aplicarTabla(x);
  };

  const problema = problemaDe(f) || errors.fecha_fin || errors.fecha_inicio || errors.vendedor_id || null;
  const exportable = !problema && fechaValida(f.desde) && fechaValida(f.hasta);
  const periodoActivo = periodos.find((p) => p.desde === f.desde && p.hasta === f.hasta)?.key ?? null;

  // Lo que muestra el reporte ahora (filtros ya aplicados por el servidor)
  const ini = filtros.fecha_inicio;
  const fin = filtros.fecha_fin;
  const periodoTexto = ini && fin
    ? (ini === fin ? fechaTexto(ini) : `${fechaTexto(ini, ini.slice(0, 4) !== fin.slice(0, 4))} – ${fechaTexto(fin)}`)
    : 'Todas las fechas';
  const vendedorNombre = vendedores.find((v) => String(v.id) === String(filtros.vendedor_id ?? ''))?.name;

  const vendido = Number(resumen.total_ventas) || 0;
  const ganancia = Number(resumen.total_ganancia) || 0;
  const invertido = Number(resumen.total_inversion) || 0;
  const descuentos = Number(resumen.total_descuento) || 0;
  const permutas = Number(resumen.total_permuta) || 0;
  const movimientos = Number(resumen.movimientos) || 0;
  const margen = vendido > 0 ? Math.round((ganancia / vendido) * 100) : null;
  const g = resumen.ganancias_por_tipo || {};
  const distribucion = [
    { label: 'Celulares', valor: Number(g.celulares) || 0 },
    { label: 'Computadoras', valor: Number(g.computadoras) || 0 },
    { label: 'Productos Generales', valor: Number(g.generales) || 0 },
    { label: 'Equipos de marca', valor: Number(g.productos_apple) || 0 },
    { label: 'Servicios Técnicos', valor: Number(g.servicio_tecnico) || 0 },
  ];

  const filas = ventas?.data ?? [];
  const hayFiltrosTabla = Boolean(filtros.tipo || filtros.buscar);
  const rebajasVista = (Number(totalesVista.descuento) || 0) + (Number(totalesVista.permuta) || 0);

  const exportarHref = exportable
    ? route('admin.reportes.exportar', Object.fromEntries(Object.entries({
      fecha_inicio: f.desde, fecha_fin: f.hasta, vendedor_id: f.vendedor, tipo: f.tipo,
    }).filter(([, v]) => v)))
    : null;

  return (
    <AdminLayout>
      <Head title="Reportes" />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Reportes"
          subtitle="Ventas y servicios técnicos: cuánto se vendió, cuánto se ganó y cuánto capital se usó en el período."
        />

        {/* Período, vendedor y exportación */}
        <section className="rounded-2xl border border-gris-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-gris-400">
                <CalendarRange className="h-4 w-4 text-[#96684F]" /> Período
              </span>
              {periodos.map((p) => (
                <button key={p.key} type="button" onClick={() => cambiarPeriodo({ desde: p.desde, hasta: p.hasta })} aria-pressed={periodoActivo === p.key}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${periodoActivo === p.key ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {vendedores.length > 0 && (
                <select value={f.vendedor} onChange={(e) => cambiarVendedor(e.target.value)} aria-label="Vendedor"
                  className={`${inputCls} h-11 pr-9 sm:w-52`}>
                  <option value="">Todos los vendedores</option>
                  {vendedores.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                </select>
              )}

              {/* Las fechas y el botón de exportar van juntos: el PDF sale con este mismo período */}
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-gris-200 bg-white transition focus-within:border-[#96684F] focus-within:ring-4 focus-within:ring-[#96684F]/15 sm:flex sm:h-11 sm:items-stretch">
                <label className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 sm:py-0">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400">Desde</span>
                  <input type="date" value={f.desde} max={f.hasta || undefined} className={fechaCls}
                    onChange={(e) => {
                      const d = e.target.value;
                      // Al elegir solo el inicio, el período llega hasta hoy
                      cambiarPeriodo({ desde: d, hasta: f.hasta || (d ? (d > hoy ? d : hoy) : '') }, true);
                    }} />
                </label>
                <label className="flex min-w-0 flex-col justify-center gap-0.5 border-l border-gris-200 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 sm:py-0">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400">Hasta</span>
                  <input type="date" value={f.hasta} min={f.desde || undefined} className={fechaCls}
                    onChange={(e) => cambiarPeriodo({ hasta: e.target.value }, true)} />
                </label>
                {exportarHref ? (
                  <a href={exportarHref} title="Descarga el PDF del período, vendedor y tipo elegidos"
                    className="col-span-2 flex items-center justify-center gap-2 border-t border-gris-200 bg-[#121214] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D1D21] sm:border-l sm:border-t-0 sm:py-0">
                    <Download className="h-4 w-4" /> Exportar PDF
                  </a>
                ) : (
                  <span aria-disabled="true" title={problema || 'Completa las fechas'}
                    className="col-span-2 flex cursor-not-allowed items-center justify-center gap-2 border-t border-gris-200 bg-gris-100 px-4 py-2.5 text-sm font-semibold text-gris-400 sm:border-l sm:border-t-0 sm:py-0">
                    <Download className="h-4 w-4" /> Exportar PDF
                  </span>
                )}
              </div>
            </div>
          </div>
          {problema && <p className="mt-2 text-xs font-semibold text-amber-700 xl:text-right" role="status">{problema}</p>}
        </section>

        {/* Resumen del período */}
        <div className={`grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-4 ${cargando ? 'opacity-60' : ''}`}>
          <Stat icon={Wallet} label="Total vendido" value={bsFmt(vendido)}
            hint={`${movimientos.toLocaleString('es-BO')} ${movimientos === 1 ? 'movimiento' : 'movimientos'} · ${periodoTexto}${vendedorNombre ? ` · ${vendedorNombre}` : ''}`} />
          <Stat icon={TrendingUp} label="Ganancia" value={ganancia < 0 ? conSigno(ganancia) : bsFmt(ganancia)} tone="emerald"
            hint={margen !== null ? `Margen de ${margen} % sobre lo vendido` : 'Sin ventas en este período'} />
          <Stat icon={PiggyBank} label="Capital invertido" value={bsFmt(invertido)} tone="lila" hint="Costo de lo vendido" />
          <Stat icon={BadgePercent} label="Descuentos y permutas" value={bsFmt(descuentos + permutas)} tone="rose"
            hint={`Descuentos ${bsFmt(descuentos)} · Permutas ${bsFmt(permutas)}`} />
        </div>

        {/* Servicios técnicos que registró un vendedor y todavía no tienen costo: su utilidad no está sumada */}
        {Number(resumen.servicios_sin_costo) > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-900" role="status">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1">
              <span className="font-bold">
                {Number(resumen.servicios_sin_costo) === 1
                  ? '1 servicio técnico de este período no tiene el costo cargado.'
                  : `${resumen.servicios_sin_costo} servicios técnicos de este período no tienen el costo cargado.`}
              </span>{' '}
              Su utilidad no está sumada en la ganancia hasta que lo cargues.
            </p>
            <button type="button" onClick={() => router.visit(route('admin.servicios.index', { pendientes: 1 }))}
              className={buttonCls('secondary', 'h-9 border-amber-300 px-3 text-amber-900 hover:bg-amber-100')}>
              Cargar costos
            </button>
          </div>
        )}

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <AllocationDonut distribucion={distribucion} total={ganancia} serie={serie} cargando={cargando} />
          <PorVendedor filas={porVendedor} />
        </div>

        {/* Detalle */}
        <section ref={tablaRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="border-b border-gris-100 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <FileText className="h-[18px] w-[18px] text-[#96684F]" /> Detalle de movimientos
                </h2>
                <span className="text-xs font-semibold text-gris-400">Lo más reciente primero · {periodoTexto}</span>
                {(cargandoTabla || cargando) && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#96684F]">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#96684F]/25 border-t-[#96684F]" /> Actualizando…
                  </span>
                )}
              </div>
              {hayFiltrosTabla && (
                <button type="button" onClick={limpiarTabla} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                  <X className="h-3.5 w-3.5" /> Quitar filtros
                </button>
              )}
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input value={f.buscar} onChange={(e) => cambiarBusqueda(e.target.value)} aria-label="Buscar en el detalle"
                placeholder="Buscar por producto, código de nota o vendedor"
                className={`${inputCls} h-11 pl-10 pr-10`} />
              {f.buscar && (
                <button type="button" onClick={() => cambiarBusqueda('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Tipo de movimiento">
              <button type="button" onClick={() => cambiarTipo('')} aria-pressed={!f.tipo}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${!f.tipo ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                Todos <span className={!f.tipo ? 'text-white/70' : 'text-gris-400'}>{movimientos.toLocaleString('es-BO')}</span>
              </button>
              {TIPOS.map((t) => {
                const activo = f.tipo === t.key;
                return (
                  <button key={t.key} type="button" onClick={() => cambiarTipo(t.key)} aria-pressed={activo}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activo ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                    {t.label} <span className={activo ? 'text-white/70' : 'text-gris-400'}>{(Number(conteoTipos?.[t.key]) || 0).toLocaleString('es-BO')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`transition-opacity ${cargandoTabla ? 'opacity-60' : ''}`} aria-busy={cargandoTabla}>
            {movimientos === 0 ? (
              <EmptyState icon={FileText} title="No hay movimientos en este período"
                text="No se registraron ventas ni servicios técnicos. Elige otro período o vendedor."
                action={(ini || fin || filtros.vendedor_id) ? (
                  <button type="button" onClick={() => { const x = { ...f, desde: '', hasta: '', vendedor: '' }; setF(x); aplicarTodo(x); }} className={buttonCls('secondary')}>
                    Ver todo
                  </button>
                ) : null} />
            ) : filas.length === 0 ? (
              <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro producto, código o tipo, o quita los filtros."
                action={<button type="button" onClick={limpiarTabla} className={buttonCls('secondary')}>Quitar filtros</button>} />
            ) : (
              <>
                {/* Escritorio */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1080px] text-[13px]">
                    <thead>
                      <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                        <th className="px-5 py-3">Fecha</th>
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Vendedor</th>
                        <th className="px-4 py-3 text-right">Capital</th>
                        <th className="px-4 py-3 text-right">Descuentos</th>
                        <th className="px-4 py-3 text-right">Subtotal</th>
                        <th className="px-5 py-3 text-right">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gris-100">
                      {filas.map((r, idx) => {
                        const descuento = Number(r.descuento) || 0;
                        const permuta = Number(r.permuta) || 0;
                        const rebajas = descuento + permuta;
                        return (
                          <tr key={`${r.codigo}-${r.fecha}-${idx}`} className="align-top transition-colors hover:bg-gris-50/70">
                            <td className="px-5 py-3">
                              <p className="whitespace-nowrap font-semibold text-gris-800">{fechaCorta(r.fecha)}</p>
                              <p className="mt-0.5 text-xs text-gris-400">{hora(r.fecha)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="max-w-[280px] truncate font-semibold text-gris-900" title={r.producto}>{r.producto}</p>
                              {r.codigo && r.codigo !== '—' && <p className="mt-0.5 font-mono text-xs font-bold text-[#96684F]">{r.codigo}</p>}
                            </td>
                            <td className="px-4 py-3"><TipoEtiqueta tipo={r.tipo} /></td>
                            <td className="px-4 py-3 text-gris-600">{r.vendedor || '—'}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gris-500">
                              {r.costo_pendiente ? <span className="text-xs font-semibold text-amber-700">Costo pendiente</span> : bsFmt(r.capital)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {rebajas > 0 ? (
                                <>
                                  <p className="text-rose-600">−{bsFmt(rebajas)}</p>
                                  {descuento > 0 && permuta > 0 && (
                                    <p className="mt-0.5 text-[11px] text-gris-400">Desc. {bsFmt(descuento)} · Permuta {bsFmt(permuta)}</p>
                                  )}
                                  {permuta > 0 && !(descuento > 0) && <p className="mt-0.5 text-[11px] text-gris-400">Permuta</p>}
                                </>
                              ) : <span className="text-gris-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-gris-900">{bsFmt(r.subtotal)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">
                              {r.costo_pendiente ? <span className="text-xs font-semibold text-gris-400">Pendiente</span> : <Ganancia valor={Number(r.ganancia) || 0} />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gris-200 bg-gris-50/70 text-[13px]">
                        <td className="px-5 py-3 font-bold text-gris-900" colSpan={4}>
                          Total {hayFiltrosTabla ? 'filtrado' : 'del período'} · {(Number(totalesVista.movimientos) || 0).toLocaleString('es-BO')} movimientos
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-gris-600">{bsFmt(totalesVista.capital)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">{rebajasVista > 0 ? `−${bsFmt(rebajasVista)}` : bsFmt(0)}</td>
                        <td className="px-4 py-3 text-right font-extrabold tabular-nums text-gris-900">{bsFmt(totalesVista.subtotal)}</td>
                        <td className={`px-5 py-3 text-right font-extrabold tabular-nums ${Number(totalesVista.ganancia) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {conSigno(Number(totalesVista.ganancia) || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Celular */}
                <ul className="divide-y divide-gris-100 md:hidden">
                  {filas.map((r, idx) => (
                    <li key={`${r.codigo}-${r.fecha}-${idx}`} className="space-y-2.5 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gris-900">{r.producto}</p>
                          <p className="text-xs text-gris-400">
                            {fechaCorta(r.fecha)} · {hora(r.fecha)}{r.codigo && r.codigo !== '—' ? ` · ${r.codigo}` : ''}
                          </p>
                        </div>
                        <TipoEtiqueta tipo={r.tipo} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-gris-50 p-3 text-center">
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Capital</p><p className="text-sm font-semibold tabular-nums text-gris-600">{r.costo_pendiente ? 'Pendiente' : bsFmt(r.capital)}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Subtotal</p><p className="text-sm font-bold tabular-nums text-gris-900">{bsFmt(r.subtotal)}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Ganancia</p><p className={`text-sm font-bold tabular-nums ${r.costo_pendiente ? 'text-gris-400' : Number(r.ganancia) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{r.costo_pendiente ? 'Pendiente' : conSigno(Number(r.ganancia) || 0)}</p></div>
                      </div>
                      <p className="text-xs text-gris-500">Vendedor: {r.vendedor || '—'}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <Paginador meta={ventas} onPagina={irAPagina} porPagina={f.porPagina} onPorPagina={cambiarPorPagina} cargando={cargandoTabla} />
        </section>
      </div>
    </AdminLayout>
  );
}
