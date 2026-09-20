import AdminLayout, { MARCA, FUENTE_MARCA } from '@/Layouts/AdminLayout';
import { BarraComposicion, Metrica, Sparkline, TituloSeccion } from '@/Components/Panel/Metricas';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { route } from 'ziggy-js';
import axios from 'axios';

import TrendChart from '@/Components/Admin/charts/TrendChart';
import AllocationDonut from '@/Components/Admin/charts/AllocationDonut';
import IosNotification from '@/Components/IosNotification';
import { puede } from '@/Layouts/PanelShell';
import { IconoPieza } from '@/Components/Admin/piezas';
import {
  ArrowRight, BadgePercent, Bell, BellOff, Boxes, CalendarRange, ChartLine, Check, CheckCheck, ChevronDown,
  CircleDollarSign, DollarSign, Hammer, Laptop, Minus, Package, PencilLine, PiggyBank, Receipt, Repeat, ShoppingCart,
  Smartphone, Tablet, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';

dayjs.locale('es');

/* =======================
   HELPERS MONEDA SEGUROS
======================= */

const safeNum = (x) => {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
  if (typeof x === 'string') {
    let value = x.trim();
    if (value.includes('Bs')) value = value.replace(/Bs/gi, '').trim();
    // Formato boliviano 1.100,00
    if (value.includes(',') && value.includes('.')) value = value.replace(/\./g, '').replace(',', '.');
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const fmtBs = (n) =>
  `Bs ${safeNum(n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Montos negativos: se muestran como inversión, igual que antes
const fmtResultado = (n) => (safeNum(n) < 0 ? `Se invirtió ${fmtBs(Math.abs(safeNum(n)))}` : fmtBs(n));

const notificationTarget = (n) => {
  if (n?.type === 'report' && n?.report_id) return route('admin.automation.show', n.report_id);
  if (n?.type === 'sale_edit' && n?.sale_id) return route('admin.ventas.edit', n.sale_id);
  if (['sale', 'sale_edit'].includes(n?.type)) return route('admin.ventas.index');
  if (n?.type === 'service') return route('admin.servicios.index');
  // Un servicio que registró un vendedor sin costo: la lista se abre con los pendientes
  if (n?.type === 'servicio_sin_costo') return route('admin.servicios.index', { pendientes: 1 });
  return route('admin.dashboard');
};

const NOTIF_META = {
  sale_edit: { label: 'Venta editada', color: '#D97706', bg: '#FEF3C7', action: 'Ver venta', icon: PencilLine },
  sale:      { label: 'Venta nueva',   color: '#0A7A4B', bg: '#DCFCE7', action: 'Ver ventas', icon: ShoppingCart },
  report:    { label: 'Reporte',       color: MARCA.bronceFuerte, bg: '#F3E8DD', action: 'Ver reporte', icon: ChartLine },
  service:   { label: 'Servicio',      color: '#0369A1', bg: '#E0F2FE', action: 'Ver servicios', icon: Hammer },
  servicio_sin_costo: { label: 'Falta el costo', color: '#B45309', bg: '#FEF3C7', action: 'Cargar costo', icon: Hammer },
  stock:     { label: 'Stock',         color: '#BE123C', bg: '#FFE4E6', action: 'Ver resumen', icon: Boxes },
};
const notificationMeta = (n) => NOTIF_META[n?.type] ?? { label: 'Sistema', color: '#475569', bg: '#F1F5F9', action: 'Ver', icon: Bell };

// ─── Animaciones ─────────────────────────────────────────────────────────────
const EASE = [0.22, 1, 0.36, 1];
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

/* =======================
   PIEZAS
======================= */

function Panel({ title, icon: Icon, actions, children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-gris-900">
            {Icon && <Icon className="h-[17px] w-[17px] text-[color:var(--acento)]" />} {title}
          </h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function HeroAction({ href, onClick, icon: Icon, children, primary, as = 'link', ...rest }) {
  const cls = `inline-flex h-11 items-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors ${
    primary ? 'bg-bronce-400 text-carbon-950 shadow-[0_10px_24px_-12px_rgba(196,154,124,0.9)] hover:bg-bronce-300' : 'border border-white/[0.12] bg-white/[0.06] text-white hover:bg-white/[0.12]'
  }`;
  const style = undefined;
  const inner = <><Icon className="h-[18px] w-[18px]" /> {children}</>;
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="relative">
      {as === 'link'
        ? <Link href={href} className={cls} style={style}>{inner}</Link>
        : <button type="button" onClick={onClick} className={cls} style={style} {...rest}>{inner}</button>}
    </motion.div>
  );
}

function AgregarProducto() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // La lista completa del inventario, y solo lo que el rol puede abrir de verdad:
  // un atajo que lleva a una pantalla que el servidor va a rechazar no es un atajo.
  const { auth } = usePage().props;
  const opciones = [
    { r: 'admin.celulares.create', label: 'Celular', icon: Smartphone, modulo: 'inventario' },
    { r: 'admin.computadoras.create', label: 'Computadora', icon: Laptop, modulo: 'inventario' },
    { r: 'admin.productos-apple.create', label: 'Equipo de marca', icon: Tablet, modulo: 'inventario' },
    { r: 'admin.productos-generales.create', label: 'Accesorio o general', icon: Package, modulo: 'inventario' },
    { r: 'admin.piezas.create', label: 'Pieza o repuesto', icon: IconoPieza, modulo: 'piezas' },
  ].filter((o) => puede(auth?.permisos, o.modulo));

  if (opciones.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <HeroAction as="button" icon={Package} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Agregar producto <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </HeroAction>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-40 mt-2 w-56 rounded-[14px] border border-gris-200 bg-white p-1.5 shadow-alzada"
          >
            {opciones.map(({ r, label, icon: Icon }) => (
              <Link key={r} href={route(r)} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-gris-700 hover:bg-gris-50">
                <Icon className="h-4 w-4 text-[color:var(--acento)]" /> {label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =======================
   PÁGINA
======================= */

export default function Dashboard({
  user,
  resumen = {},
  resumen_total = {},
  vendedores = [],
  filtros = {},
  distribucion_economica = [],
  serie = { granularidad: 'dia', puntos: [] },
}) {
  const hoyStr = dayjs().format('YYYY-MM-DD');

  const [fechaInicio, setFechaInicio] = useState(filtros.fecha_inicio || hoyStr);
  // Si el período termina en el futuro (p. ej. «este mes»), se muestra hasta hoy: no hay datos por delante
  const [fechaFin, setFechaFin] = useState(filtros.fecha_fin && filtros.fecha_fin < hoyStr ? filtros.fecha_fin : hoyStr);
  const [vendedorId, setVendedorId] = useState(filtros.vendedor_id || '');

  const ultimasVentas = Array.isArray(resumen?.ultimas_ventas) ? resumen.ultimas_ventas : [];

  /* ── Notificaciones ── */
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    axios.get('/admin/notifications')
      .then((res) => setNotifications(res.data.notifications ?? []))
      .catch(() => {});
  }, []);

  const noLeidas = notifications.filter((n) => !n.read);

  const marcarLeida = (id) => {
    axios.post(`/admin/notifications/${id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
  };
  const marcarTodas = () => noLeidas.forEach((n) => marcarLeida(n.id));

  /* ── Filtros ── */
  const [cargando, setCargando] = useState(false);
  const filtrar = (inicio = fechaInicio, fin = fechaFin) => {
    router.get(route('admin.dashboard'), { fecha_inicio: inicio, fecha_fin: fin, vendedor_id: vendedorId }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setCargando(true),
      onFinish: () => setCargando(false),
    });
  };
  const handleFiltrar = (e) => { e.preventDefault(); filtrar(); };
  const RAPIDOS = [
    { key: 'hoy', label: 'Hoy', inicio: hoyStr },
    { key: '7d', label: '7 días', inicio: dayjs().subtract(6, 'day').format('YYYY-MM-DD') },
    { key: 'mes', label: 'Este mes', inicio: dayjs().startOf('month').format('YYYY-MM-DD') },
    { key: 'anio', label: 'Este año', inicio: dayjs().startOf('year').format('YYYY-MM-DD') },
  ];
  const rapido = (r) => { setFechaInicio(r.inicio); setFechaFin(hoyStr); filtrar(r.inicio, hoyStr); };
  const presetPorClave = (k) => { const r = RAPIDOS.find((x) => x.key === k); if (r) rapido(r); };
  const presetActivo = RAPIDOS.find((r) => fechaInicio === r.inicio && fechaFin === hoyStr)?.key ?? null;

  /* ── Reporte semanal automático (n8n) ── */
  const [automationReport, setAutomationReport] = useState(null);

  useEffect(() => {
    axios.get(route('admin.automation.latestWeekly'))
      .then((res) => {
        if (res.data?.show && res.data?.report) {
          const periodKey = `automation_seen_${res.data.report.period}`;
          if (!localStorage.getItem(periodKey)) {
            setAutomationReport(res.data.report);
            localStorage.setItem(periodKey, '1');
          }
        }
      })
      .catch(() => {});
  }, []);

  const parsedAutomation = useMemo(() => {
    if (!automationReport?.content) return null;
    try {
      return typeof automationReport.content === 'string' ? JSON.parse(automationReport.content) : automationReport.content;
    } catch {
      return null;
    }
  }, [automationReport]);

  const utilidadSemana = parsedAutomation?.metricas?.utilidad_semana ?? 0;
  const variacion = safeNum(parsedAutomation?.metricas?.variacion_porcentual);
  const performanceColor = variacion > 0 ? 'green' : variacion < 0 ? 'rose' : 'sky';
  const VariacionIcon = variacion > 0 ? TrendingUp : variacion < 0 ? TrendingDown : Minus;

  const nombre = (user?.name || 'Administrador').split(' ')[0];
  const ganancia = safeNum(resumen_total?.ganancia_neta);
  const utilidad = safeNum(resumen_total?.utilidad_disponible);

  // La forma del período, para los gráficos mínimos de cada tarjeta.
  const puntos = Array.isArray(serie?.puntos) ? serie.puntos : [];
  const serieDe = (campo) => puntos.map((p) => safeNum(p?.[campo]));

  // De qué está hecho lo cobrado: lo que queda, lo que se invirtió y lo que se resignó.
  const inversion = safeNum(resumen_total?.total_costo) + safeNum(resumen_total?.total_permuta);
  const descuentos = safeNum(resumen_total?.total_descuento);
  const composicion = [
    { etiqueta: 'Ganancia', valor: Math.max(ganancia, 0), color: 'var(--ok-fuerte)' },
    { etiqueta: 'Inversión', valor: inversion, color: 'var(--acento)' },
    { etiqueta: 'Descuentos', valor: descuentos, color: 'var(--gris-300)' },
  ];
  const periodo = fechaInicio === fechaFin
    ? dayjs(fechaInicio).format('D [de] MMMM')
    : `${dayjs(fechaInicio).format('D MMM')} – ${dayjs(fechaFin).format('D MMM YYYY')}`;

  const dateCls = 'h-10 w-full rounded-[10px] border border-gris-200 bg-white px-3 text-sm text-gris-800 outline-none transition-colors focus:border-[color:var(--acento)] focus:ring-4 focus:ring-[rgb(var(--acento-rgb)_/_0.16)]';

  return (
    <AdminLayout>
      <Head title="Resumen" />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-6">
        {/* ================= PORTADA ================= */}
        {/* La portada no lleva `overflow-hidden`: recortaba el menú de «Agregar producto» justo
            en su borde. Lo que hay que recortar es la decoración, no lo que se despliega. */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="relative z-10 rounded-[20px] p-6 lg:p-8"
          style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #121214 46%, #1D1D21 100%)' }}
        >
          {/* La decoración vive en su propia caja recortada, con el mismo radio que la portada */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]">
            {/* Retícula técnica: da profundidad sin competir con la cifra */}
            <span className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'radial-gradient(120% 90% at 15% 20%, #000 35%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(120% 90% at 15% 20%, #000 35%, transparent 100%)',
              }} />
            <span className="absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl"
              style={{ background: 'rgba(196, 154, 124, 0.16)' }} />
          </span>

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bronce-400">
                {dayjs().format('dddd D [de] MMMM')}
              </p>
              <h1 className="mt-2.5 font-marca text-[38px] font-bold leading-[1.05] tracking-tight text-white lg:text-[42px]">
                Hola, {nombre}
              </h1>
              <p className="mt-2 text-[15px] text-white/55">Esto es lo que pasó en el período que estás mirando.</p>
            </div>

            {/* Vendido hoy: el dato que se mira sin pensar, separado del resto */}
            <div className="shrink-0 rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-5 py-4 lg:min-w-[240px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Vendido hoy</p>
              <p className="mt-1.5 font-marca text-[30px] font-bold leading-none tracking-tight tabular-nums text-white">
                {fmtBs(resumen?.ventas_hoy)}
              </p>
            </div>
          </div>

          <div className="relative mt-7 flex flex-wrap gap-2.5">
            <HeroAction href={route('admin.ventas.create')} icon={ShoppingCart} primary>Nueva venta</HeroAction>
            <HeroAction href={route('admin.servicios.create')} icon={Hammer}>Nuevo servicio</HeroAction>
            <AgregarProducto />
            <HeroAction href={route('admin.reportes.index')} icon={ChartLine}>Reportes</HeroAction>
          </div>
        </motion.section>

        {/* ================= CUERPO ================= */}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            {/* Período */}
            <form onSubmit={handleFiltrar} className="rounded-[14px] border border-gris-200 bg-white p-4 shadow-sutil">
              <div className="flex flex-wrap items-end gap-3">
                <div className="mr-auto">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-gris-900">
                    <CalendarRange className="h-[17px] w-[17px] text-[color:var(--acento)]" /> Período
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {RAPIDOS.map((r) => {
                      const activo = fechaInicio === r.inicio && fechaFin === hoyStr;
                      return (
                        <button key={r.key} type="button" onClick={() => rapido(r)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activo ? 'bg-carbon-900 text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block w-[150px]">
                  <span className="mb-1 block text-xs font-semibold text-gris-500">Desde</span>
                  <input type="date" value={fechaInicio} max={fechaFin} onChange={(e) => setFechaInicio(e.target.value)} className={dateCls} />
                </label>
                <label className="block w-[150px]">
                  <span className="mb-1 block text-xs font-semibold text-gris-500">Hasta</span>
                  <input type="date" value={fechaFin} min={fechaInicio} max={hoyStr} onChange={(e) => setFechaFin(e.target.value)} className={dateCls} />
                </label>
                <label className="block w-[170px]">
                  <span className="mb-1 block text-xs font-semibold text-gris-500">Vendedor</span>
                  <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className={dateCls}>
                    <option value="">Todos</option>
                    {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </label>
                <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-carbon-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-carbon-800">
                  Aplicar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Resultados del período */}
            <div>
              <TituloSeccion extra={<span className="text-[12px] font-medium text-gris-400">{periodo}</span>}>
                Resultados del período
              </TituloSeccion>

              <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                {/* La cifra que manda: lo que de verdad quedó */}
                <motion.div variants={rise}>
                  <Metrica
                    destacada
                    etiqueta="Utilidad disponible"
                    valor={fmtResultado(utilidad)}
                    hint="Ganancia menos egresos"
                    icono={PiggyBank}
                    serie={serieDe('utilidad')}
                  />
                </motion.div>

                {/* De qué está hecho lo cobrado */}
                <motion.div variants={rise}
                  className="flex flex-col justify-between rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gris-500">Total vendido</p>
                    <p className="mt-3 font-marca text-[26px] font-bold leading-none tracking-tight tabular-nums text-gris-900">
                      {fmtBs(resumen_total?.total_ventas)}
                    </p>
                    <p className="mt-2 text-[12px] text-gris-500">Precio final pagado por el cliente</p>
                  </div>
                  <BarraComposicion partes={composicion} className="mt-5" />
                </motion.div>
              </motion.div>

              <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                <motion.div variants={rise}>
                  <Metrica
                    etiqueta="Ganancia neta"
                    valor={fmtResultado(ganancia)}
                    hint="Antes de egresos"
                    icono={ganancia < 0 ? TrendingDown : TrendingUp}
                    tono={ganancia < 0 ? 'negativo' : 'positivo'}
                    serie={serieDe('ganancia')}
                  />
                </motion.div>
                <motion.div variants={rise}>
                  <Metrica
                    etiqueta="Inversión"
                    valor={fmtBs(inversion)}
                    hint="Costo de lo vendido más permutas"
                    icono={Wallet}
                    tono="acento"
                    serie={serieDe('inversion')}
                  />
                </motion.div>
                <motion.div variants={rise}>
                  <Metrica
                    etiqueta="Descuentos"
                    valor={fmtBs(descuentos)}
                    hint={descuentos > 0 ? 'Lo que se resignó para cerrar' : 'No se descontó nada'}
                    icono={BadgePercent}
                    tono={descuentos > 0 ? 'aviso' : 'neutro'}
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Operación y stock */}
            <div>
              <TituloSeccion>Operación y stock</TituloSeccion>
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <motion.div variants={rise}>
                  <Metrica etiqueta="Servicios técnicos" valor={(resumen?.servicios || 0).toLocaleString('es-BO')}
                    hint="Registrados en el período" icono={Hammer} tono="acento" />
                </motion.div>
                <motion.div variants={rise}>
                  <Metrica etiqueta="Cotizaciones" valor={(resumen?.cotizaciones || 0).toLocaleString('es-BO')}
                    hint="Enviadas en el período" icono={Receipt} tono="acento" />
                </motion.div>
                <motion.div variants={rise}>
                  <Metrica etiqueta="Stock disponible" valor={(resumen?.stock_total || 0).toLocaleString('es-BO')}
                    hint="Unidades listas para vender" icono={Boxes} />
                </motion.div>
                <motion.div variants={rise}>
                  <Metrica etiqueta="Ventas del período" valor={(puntos.reduce((n, p) => n + safeNum(p?.ventas), 0)).toLocaleString('es-BO')}
                    hint="Productos que salieron" icono={ShoppingCart} serie={serieDe('ventas')} />
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* ================= NOTIFICACIONES ================= */}
          <Panel
            title="Novedades"
            icon={Bell}
            className="xl:sticky xl:top-24"
            actions={
              <div className="flex items-center gap-2">
                {noLeidas.length > 0 && (
                  <button type="button" onClick={marcarTodas} title="Marcar todas como leídas"
                    className="grid h-8 w-8 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-gris-100 hover:text-gris-700">
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={noLeidas.length ? { background: MARCA.bronce, color: MARCA.negro } : { background: '#F1F5F9', color: '#64748B' }}>
                  {noLeidas.length} {noLeidas.length === 1 ? 'nueva' : 'nuevas'}
                </span>
              </div>
            }
          >
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gris-100 text-gris-400"><BellOff className="h-5 w-5" /></span>
                <p className="mt-3 text-sm font-semibold text-gris-700">Todo al día</p>
                <p className="mt-1 text-xs text-gris-500">Aquí verás las ventas, los servicios y los reportes nuevos.</p>
              </div>
            ) : (
              <ul className="max-h-[560px] divide-y divide-gris-100 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {notifications.map((n, i) => {
                    const meta = notificationMeta(n);
                    const Icon = meta.icon;
                    return (
                      <motion.li key={n.id} layout
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: EASE }}
                        className={`relative flex gap-3 px-5 py-4 transition-colors ${n.read ? '' : 'bg-[rgb(var(--acento-rgb)_/_0.05)]'}`}>
                        {!n.read && <span className="absolute left-0 top-4 h-9 w-[3px] rounded-r-full" style={{ background: MARCA.bronce }} />}
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: meta.bg, color: meta.color }}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold leading-snug text-gris-900">{n.title}</p>
                            <span className="shrink-0 text-[11px] text-gris-400">{dayjs(n.created_at).format('DD/MM HH:mm')}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[13px] leading-relaxed text-gris-600">{n.message}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <button type="button" onClick={() => router.visit(notificationTarget(n))}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--acento)] hover:text-carbon-900">
                              {meta.action} <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                            {!n.read && (
                              <button type="button" onClick={() => marcarLeida(n.id)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-gris-400 hover:text-gris-700">
                                <Check className="h-3.5 w-3.5" /> Marcar leída
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </Panel>
        </div>

        {/* ================= GRÁFICOS ================= */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid items-stretch gap-6 xl:grid-cols-2">
          <motion.div variants={rise} className="h-full min-w-0">
            <TrendChart
              serie={serie}
              rango={periodo}
              cargando={cargando}
              onPreset={presetPorClave}
              presetActivo={presetActivo}
              totales={{
                ingresos: safeNum(resumen_total?.total_ventas),
                inversion: safeNum(resumen_total?.total_costo) + safeNum(resumen_total?.total_permuta),
                utilidad: safeNum(resumen_total?.utilidad_disponible),
              }}
            />
          </motion.div>
          <motion.div variants={rise} className="h-full min-w-0">
            <AllocationDonut distribucion={distribucion_economica} total={resumen_total?.ganancia_neta} serie={serie} cargando={cargando} />
          </motion.div>
        </motion.div>

        {/* ================= ÚLTIMAS VENTAS ================= */}
        <Panel title="Últimas ventas" icon={ShoppingCart}
          actions={<Link href={route('admin.ventas.index')} className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--acento)] hover:text-carbon-900">Ver todas <ArrowRight className="h-4 w-4" /></Link>}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gris-50 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-gris-500">
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gris-100">
                {ultimasVentas.length === 0 ? (
                  <tr>
                    <td className="px-5 py-10 text-center text-gris-500" colSpan={4}>No hay ventas en este período.</td>
                  </tr>
                ) : ultimasVentas.map((v, i) => (
                  <tr key={`${v?.fecha ?? 'x'}-${i}`} className="transition-colors hover:bg-gris-50/70">
                    <td className="px-5 py-3 font-semibold text-gris-900">{v?.producto || '—'}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-bronce-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-bronce-800">{String(v?.tipo || '—').replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-gris-900">{fmtBs(v?.total)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gris-500">{v?.fecha ? dayjs(v.fecha).format('DD/MM/YYYY') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ================= REPORTE SEMANAL (n8n) ================= */}
      {automationReport && (
        <IosNotification
          color={performanceColor}
          title="Inteligencia del negocio"
          subtitle="Reporte semanal inteligente"
          message={
            parsedAutomation ? (
              <>
                {parsedAutomation.resumen_ejecutivo?.descripcion ?? ''}
                <br /><br />
                <span className="inline-flex items-center gap-1"><DollarSign size={14} /> Utilidad: {fmtBs(utilidadSemana)}</span>
                <br />
                <span className="inline-flex items-center gap-1"><VariacionIcon size={14} /> Variación: {variacion}%</span>
              </>
            ) : 'Nuevo análisis inteligente disponible'
          }
          onView={async () => {
            try { await axios.post(route('admin.automation.markViewed', automationReport.id)); } catch { /* sigue */ }
            router.visit(route('admin.automation.show', automationReport.id));
          }}
          onClose={() => setAutomationReport(null)}
        />
      )}
    </AdminLayout>
  );
}
