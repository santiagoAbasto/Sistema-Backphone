import { Head, Link, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useMemo, useState } from 'react';
import {
  AlarmClock, Ban, CalendarCheck, CheckCircle2, FileText, Hourglass, PiggyBank, Plus, Printer, Search,
  ShoppingCart, Wallet, X,
} from 'lucide-react';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';
import {
  Badge, Button, EmptyState, Modal, PageHeader, Toast, bsFmt, buttonCls, inputCls, useToast,
} from '@/Components/Admin/ui';

const ESTADOS = {
  activa: { label: 'Activa', tone: 'emerald', icon: Hourglass },
  vendida: { label: 'Vendida', tone: 'navy', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', tone: 'rose', icon: Ban },
  vencida: { label: 'Vencida', tone: 'amber', icon: AlarmClock },
};

const CONFIRMACIONES = {
  cancelada: {
    titulo: 'Cancelar la reserva',
    texto: 'La reserva deja de estar activa y sus productos vuelven a quedar disponibles para la venta.',
    boton: 'Sí, cancelar reserva',
    variant: 'danger',
  },
  vencida: {
    titulo: 'Marcar como vencida',
    texto: 'Úsalo cuando el cliente no volvió en el plazo acordado. Sus productos vuelven a quedar disponibles para la venta.',
    boton: 'Sí, marcar como vencida',
    variant: 'primary',
  },
};

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TZ = 'America/La_Paz';
// `reservas.fecha` llega sin hora («2026-09-14»): si se lee como UTC, en Bolivia se muestra el día anterior
const fecha = (v) => {
  if (!v) return '—';
  const opciones = { day: '2-digit', month: 'short', year: 'numeric' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, d] = v.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-BO', opciones);
  }
  return new Date(v).toLocaleDateString('es-BO', { ...opciones, timeZone: TZ });
};
const saldoDe = (r) => Math.max(0, Number(r.subtotal || 0) - Number(r.monto_reserva || 0));
const nombreItem = (item) => item?.nombre_producto || item?.modelo || item?.nombre || 'Producto';

function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-[#121214]/[0.07] text-[#121214]',
    emerald: 'bg-emerald-50 text-emerald-700',
    lila: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 text-[24px] font-extrabold leading-none tracking-tight text-gris-900">{value}</p>
      {hint && <p className="mt-2 text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] ?? { label: estado, tone: 'slate', icon: Hourglass };
  const Icon = e.icon;
  return <Badge tone={e.tone}><Icon className="h-3 w-3" /> {e.label}</Badge>;
}

function Doc({ href, icon: Icon, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 transition-colors hover:border-gris-300 hover:text-gris-900">
      <Icon className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

export default function ReservasIndex({ reservas = [], Layout, prefijo = 'admin', titulo, subtitulo, guia = null }) {
  useAutoRefresh(['reservas', 'ventas']);
  const [toast, show] = useToast();

  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('todas');
  const [confirmar, setConfirmar] = useState(null); // { reserva, estado }
  const [procesando, setProcesando] = useState(false);

  const cambiarEstado = () => {
    if (!confirmar) return;
    router.patch(route(`${prefijo}.reservas.estado`, confirmar.reserva.id), { estado: confirmar.estado }, {
      preserveScroll: true,
      onStart: () => setProcesando(true),
      onError: (errs) => show(errs.estado ?? 'No se pudo actualizar la reserva.', 'error'),
      onFinish: () => { setProcesando(false); setConfirmar(null); },
    });
  };

  // Resumen (sobre todas las reservas)
  const activas = reservas.filter((r) => r.estado === 'activa');
  const abonadoActivas = activas.reduce((acc, r) => acc + Number(r.monto_reserva || 0), 0);
  const saldoActivas = activas.reduce((acc, r) => acc + saldoDe(r), 0);
  const vendidas = reservas.filter((r) => r.estado === 'vendida').length;
  const conteo = reservas.reduce((acc, r) => ({ ...acc, [r.estado]: (acc[r.estado] || 0) + 1 }), {});

  // Filtros
  const q = normalizar(texto.trim());
  const filtradas = useMemo(() => reservas.filter((r) =>
    (estado === 'todas' || r.estado === estado)
    && (!q || normalizar([
      r.nombre_cliente, r.telefono_cliente, r.codigo_nota, prefijo === 'admin' ? r.vendedor?.name : '', ...(r.items || []).map(nombreItem),
    ].join(' ')).includes(q)),
  ), [reservas, estado, q]);

  const hayFiltros = q || estado !== 'todas';
  const limpiar = () => { setTexto(''); setEstado('todas'); };
  const conf = confirmar ? CONFIRMACIONES[confirmar.estado] : null;

  const Acciones = ({ r }) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {r.estado === 'activa' && (
        <Link href={route(`${prefijo}.ventas.create`, { reserva_id: r.id })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#121214] px-3 text-xs font-bold text-white transition-colors hover:bg-[#1D1D21]">
          <ShoppingCart className="h-3.5 w-3.5" /> Vender
        </Link>
      )}
      {r.estado === 'vendida' && r.venta && (
        <Link href={route(`${prefijo}.ventas.edit`, r.venta.id)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 hover:border-gris-300 hover:text-gris-900">
          Ver venta <span className="font-mono text-[color:var(--acento)]">{r.venta.codigo_nota}</span>
        </Link>
      )}
      <Doc href={route(`${prefijo}.reservas.boleta`, r.id)} icon={FileText} label="Nota" />
      <Doc href={route(`${prefijo}.reservas.boleta80`, r.id)} icon={Printer} label="Térmica" />
      {r.estado === 'activa' && (
        <>
          <button type="button" onClick={() => setConfirmar({ reserva: r, estado: 'vencida' })} title="Marcar como vencida" aria-label={`Marcar ${r.codigo_nota} como vencida`}
            className="grid h-8 w-8 place-items-center rounded-lg border border-gris-200 bg-white text-amber-600 transition-colors hover:border-amber-300 hover:bg-amber-50">
            <AlarmClock className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setConfirmar({ reserva: r, estado: 'cancelada' })} title="Cancelar reserva" aria-label={`Cancelar ${r.codigo_nota}`}
            className="grid h-8 w-8 place-items-center rounded-lg border border-gris-200 bg-white text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50">
            <Ban className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <Layout title="Reservas">
      <Head title="Reservas" />
      <Toast toast={toast} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title={titulo ?? 'Reservas'}
          subtitle={subtitulo ?? 'Productos separados con un abono. Desde aquí los vendes, cancelas o imprimes su nota.'}
          actions={
            <Link href={route(`${prefijo}.reservas.create`)} className={buttonCls('primary', 'h-11 px-5')}>
              <Plus className="h-4 w-4" /> Nueva reserva
            </Link>
          }
        />

        {guia}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Hourglass} label="Reservas activas" value={activas.length.toLocaleString('es-BO')} hint="Productos separados ahora" tone="emerald" />
          <Stat icon={PiggyBank} label="Abonado en activas" value={bsFmt(abonadoActivas)} tone="lila" />
          <Stat icon={Wallet} label="Saldo por cobrar" value={bsFmt(saldoActivas)} hint="Lo que falta al vender las activas" />
          <Stat icon={CheckCircle2} label="Convertidas en venta" value={vendidas.toLocaleString('es-BO')} hint={`de ${reservas.length.toLocaleString('es-BO')} reservas`} tone="amber" />
        </div>

        {/* Búsqueda y estados */}
        <section className="rounded-2xl border border-gris-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
            <input value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={prefijo === 'admin' ? 'Buscar por cliente, teléfono, código, producto o vendedor' : 'Buscar por cliente, teléfono, código o producto'}
              className={`${inputCls} h-11 pl-10 pr-10`} />
            {texto && (
              <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[['todas', 'Todas', reservas.length], ...Object.entries(ESTADOS).map(([k, e]) => [k, e.label, conteo[k] || 0])].map(([k, label, n]) => (
              <button key={k} type="button" onClick={() => setEstado(k)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${estado === k ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                {label} <span className={estado === k ? 'text-white/70' : 'text-gris-400'}>{n}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Listado */}
        <section className="overflow-hidden rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
              <CalendarCheck className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Detalle de reservas
            </h2>
            {hayFiltros && (
              <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Quitar filtros
              </button>
            )}
          </div>

          {reservas.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Todavía no hay reservas"
              text="Cuando un cliente deje un abono para separar un producto, regístralo aquí."
              action={<Link href={route(`${prefijo}.reservas.create`)} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Registrar una reserva</Link>} />
          ) : filtradas.length === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro nombre o código, o quita los filtros."
              action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
          ) : (
            <>
              {/* Escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1040px] text-[13px]">
                  <thead>
                    <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                      <th className="px-5 py-3">Reserva</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Productos</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Abono</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-5 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {filtradas.map((r) => {
                      const items = r.items || [];
                      return (
                        <tr key={r.id} className="align-top transition-colors hover:bg-gris-50/70">
                          <td className="px-5 py-3">
                            <p className="font-mono text-[13px] font-bold text-[color:var(--acento)]">{r.codigo_nota}</p>
                            <p className="mt-0.5 whitespace-nowrap text-xs text-gris-400">{fecha(r.fecha || r.created_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[180px] truncate font-semibold text-gris-900">{r.nombre_cliente}</p>
                            <p className="mt-0.5 text-xs text-gris-400">
                              {r.telefono_cliente || 'Sin teléfono'}
                              {prefijo === 'admin' && <> · por {r.vendedor?.name || '—'}</>}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[220px] truncate font-medium text-gris-800">{items[0] ? nombreItem(items[0]) : '—'}</p>
                            {items.length > 1 && <p className="mt-0.5 text-xs text-gris-400">y {items.length - 1} más</p>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gris-700">{bsFmt(r.subtotal)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">{bsFmt(r.monto_reserva)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-gris-900">{bsFmt(saldoDe(r))}</td>
                          <td className="px-4 py-3"><EstadoBadge estado={r.estado} /></td>
                          <td className="px-5 py-3"><Acciones r={r} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Celular */}
              <ul className="divide-y divide-gris-100 md:hidden">
                {filtradas.map((r) => (
                  <li key={r.id} className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gris-900">{r.nombre_cliente}</p>
                        <p className="font-mono text-xs font-bold text-[color:var(--acento)]">{r.codigo_nota} <span className="font-sans font-normal text-gris-400">· {fecha(r.fecha || r.created_at)}</span></p>
                      </div>
                      <EstadoBadge estado={r.estado} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-gris-50 p-3 text-center">
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Total</p><p className="text-sm font-semibold tabular-nums text-gris-800">{bsFmt(r.subtotal)}</p></div>
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Abono</p><p className="text-sm font-semibold tabular-nums text-emerald-700">{bsFmt(r.monto_reserva)}</p></div>
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Saldo</p><p className="text-sm font-bold tabular-nums text-gris-900">{bsFmt(saldoDe(r))}</p></div>
                    </div>
                    <Acciones r={r} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {conf && (
        <Modal
          title={conf.titulo}
          onClose={() => !procesando && setConfirmar(null)}
          footer={
            <>
              <Button onClick={() => setConfirmar(null)} disabled={procesando}>Volver</Button>
              <Button variant={conf.variant} onClick={cambiarEstado} disabled={procesando}>
                {procesando ? 'Guardando…' : conf.boton}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gris-600">{conf.texto}</p>
          <div className="mt-4 rounded-xl border border-gris-200 bg-gris-50 px-4 py-3 text-sm">
            <p className="font-semibold text-gris-900">{confirmar.reserva.nombre_cliente} <span className="font-mono text-[color:var(--acento)]">· {confirmar.reserva.codigo_nota}</span></p>
            <p className="mt-0.5 text-gris-500">Abono registrado: {bsFmt(confirmar.reserva.monto_reserva)}</p>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
