import { Head, Link } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  Check, Mail, MessageCircle, Pencil, Search, Sparkles, UserPlus, Users, X,
} from 'lucide-react';
import {
  Badge, Button, EmptyState, Field, Modal, PageHeader, Paginador, Textarea, Toast, buttonCls, inputCls, useToast,
} from '@/Components/Admin/ui';

const TZ = 'America/La_Paz';
const MENSAJE_BASE = 'Hola {nombre}, en Blackphone tenemos promociones especiales para ti. No te las pierdas: visítanos o escríbenos ahora mismo.';

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const digitos = (t) => String(t ?? '').replace(/\D/g, '');
// Número para WhatsApp: con código de país; los de 8 dígitos que empiezan con 6 o 7 son celulares de Bolivia
const numeroWhatsapp = (tel) => {
  const d = digitos(tel);
  if (d.length === 8 && /^[67]/.test(d)) return `591${d}`;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
};
const diaLocal = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
const fechaCorta = (iso) => (iso
  ? new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
  : '—');
const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const primerNombre = (nombre) => {
  const p = String(nombre || '').trim().split(/\s+/)[0] || '';
  return p && p === p.toUpperCase() ? p.charAt(0) + p.slice(1).toLowerCase() : p;
};
const personalizar = (plantilla, c) => plantilla.replaceAll('{nombre}', primerNombre(c.nombre)).trim();
const checkCls = 'h-4 w-4 cursor-pointer rounded border-gris-300 text-carbon-900 focus:ring-2 focus:ring-[rgb(var(--acento-rgb)_/_0.3)] focus:ring-offset-0';

function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-carbon-900/[0.07] text-carbon-900',
    emerald: 'bg-emerald-50 text-emerald-700',
    lila: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="rounded-2xl border border-gris-200 bg-white p-5 shadow-sutil">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 text-[24px] font-bold leading-none tracking-tight text-gris-900">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

function Acciones({ c, prefijo }) {
  return (
    <div className="flex justify-end gap-1.5">
      {c.wa ? (
        <a href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener noreferrer" title="Abrir chat de WhatsApp" aria-label={`Abrir WhatsApp de ${c.nombre}`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-gris-200 bg-white text-emerald-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50">
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      ) : (
        <span title="Sin número de WhatsApp válido" className="grid h-8 w-8 cursor-not-allowed place-items-center rounded-lg border border-gris-100 bg-gris-50 text-gris-300">
          <MessageCircle className="h-3.5 w-3.5" />
        </span>
      )}
      <Link href={route(`${prefijo}.clientes.edit`, c.id)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 transition-colors hover:border-carbon-900 hover:bg-carbon-900 hover:text-white">
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Link>
    </div>
  );
}

// WhatsApp no permite enviar a varios a la vez desde el navegador: se prepara un botón por cliente
function PromoModal({ destinatarios, sinNumero, desdeSeleccion, onClose }) {
  const [mensaje, setMensaje] = useState(MENSAJE_BASE);
  const [paso, setPaso] = useState('mensaje');
  const [abiertos, setAbiertos] = useState([]);
  const ejemplo = destinatarios[0];
  const listo = mensaje.trim().length > 0 && destinatarios.length > 0;
  const marcar = (id) => setAbiertos((a) => (a.includes(id) ? a : [...a, id]));

  return (
    <Modal
      wide
      title="Promoción por WhatsApp"
      onClose={onClose}
      footer={paso === 'mensaje' ? (
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!listo} onClick={() => setPaso('enviar')}>
            <MessageCircle className="h-4 w-4" /> Preparar {destinatarios.length} {destinatarios.length === 1 ? 'mensaje' : 'mensajes'}
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => setPaso('mensaje')}>Volver al mensaje</Button>
          <Button variant="primary" onClick={onClose}>Listo</Button>
        </>
      )}
    >
      {paso === 'mensaje' ? (
        <div className="space-y-4">
          <p className="text-sm text-gris-600">
            Se prepara para <span className="font-bold text-gris-900">{destinatarios.length}</span>{' '}
            {destinatarios.length === 1 ? 'cliente' : 'clientes'} con WhatsApp {desdeSeleccion ? 'de tu selección' : 'de la lista'}.
            {sinNumero > 0 && <span className="font-semibold text-amber-700"> {sinNumero} sin número válido quedan fuera.</span>}
          </p>
          <Field label="Mensaje" value={mensaje} max={1000} hint="Escribe {nombre} donde quieras que aparezca el nombre de cada cliente.">
            <Textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </Field>
          {ejemplo && mensaje.trim() && (
            <div className="rounded-2xl bg-emerald-50/70 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800/70">Así lo recibe {primerNombre(ejemplo.nombre) || 'el cliente'}</p>
              <div className="mt-2 max-w-md whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-gris-800 shadow-sm">
                {personalizar(mensaje, ejemplo)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gris-600">WhatsApp abre un chat a la vez: presiona «Abrir» en cada cliente y luego enviar en WhatsApp.</p>
            <Badge tone="emerald">{abiertos.length} de {destinatarios.length} abiertos</Badge>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gris-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(abiertos.length / Math.max(1, destinatarios.length)) * 100}%` }} />
          </div>
          <ul className="mt-3 max-h-[50vh] divide-y divide-gris-100 overflow-y-auto rounded-xl border border-gris-200">
            {destinatarios.map((c) => {
              const abierto = abiertos.includes(c.id);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gris-900">{c.nombre}</p>
                    <p className="text-xs text-gris-500">{c.telefono}</p>
                  </div>
                  <a href={`https://wa.me/${c.wa}?text=${encodeURIComponent(personalizar(mensaje, c))}`} target="_blank" rel="noopener noreferrer"
                    onClick={() => marcar(c.id)}
                    className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${abierto ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                    {abierto ? <Check className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    {abierto ? 'Abierto' : 'Abrir'}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export default function ClientesIndex({ clientes = [], Layout, prefijo = 'admin', titulo, subtitulo, guia = null }) {
  const [toast] = useToast();
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [creador, setCreador] = useState('todos');
  const [orden, setOrden] = useState('recientes');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [seleccion, setSeleccion] = useState([]);
  const [promo, setPromo] = useState(false);
  const tablaRef = useRef(null);

  const inicioMes = dayjs().startOf('month').format('YYYY-MM-DD');
  const filas = useMemo(() => clientes.map((c) => ({
    ...c,
    wa: numeroWhatsapp(c.telefono),
    dia: diaLocal(c.created_at),
  })), [clientes]);

  const creadores = useMemo(() => [...new Set(filas.map((c) => c.usuario?.name).filter(Boolean))].sort(), [filas]);
  const conteo = useMemo(() => ({
    todos: filas.length,
    whatsapp: filas.filter((c) => c.wa).length,
    sin_whatsapp: filas.filter((c) => !c.wa).length,
    correo: filas.filter((c) => c.correo).length,
    nuevos: filas.filter((c) => c.dia >= inicioMes).length,
  }), [filas, inicioMes]);

  const q = normalizar(texto.trim());
  const qDigitos = digitos(texto);
  const filtrados = useMemo(() => {
    const lista = filas.filter((c) =>
      (filtro === 'todos'
        || (filtro === 'whatsapp' && c.wa)
        || (filtro === 'sin_whatsapp' && !c.wa)
        || (filtro === 'correo' && c.correo)
        || (filtro === 'nuevos' && c.dia >= inicioMes))
      && (creador === 'todos' || c.usuario?.name === creador)
      && (!q
        || normalizar([c.nombre, c.correo, c.documento, c.telefono].join(' ')).includes(q)
        || (qDigitos.length >= 3 && digitos(c.telefono).includes(qDigitos))),
    );
    return orden === 'nombre' ? [...lista].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')) : lista;
  }, [filas, filtro, creador, q, qDigitos, orden, inicioMes]);

  useEffect(() => { setPagina(1); }, [q, filtro, creador, orden, porPagina]);

  const total = filtrados.length;
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, ultima);
  const visibles = filtrados.slice((actual - 1) * porPagina, actual * porPagina);
  const meta = {
    current_page: actual,
    last_page: ultima,
    total,
    from: total ? (actual - 1) * porPagina + 1 : 0,
    to: Math.min(actual * porPagina, total),
  };
  const irAPagina = (n) => {
    setPagina(n);
    tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const paginaMarcada = visibles.length > 0 && visibles.every((c) => seleccion.includes(c.id));
  const alternar = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const alternarPagina = () => setSeleccion((s) => (paginaMarcada
    ? s.filter((id) => !visibles.some((c) => c.id === id))
    : [...new Set([...s, ...visibles.map((c) => c.id)])]));
  const todosFiltradosMarcados = total > 0 && filtrados.every((c) => seleccion.includes(c.id));

  // Destinatarios de la promoción: la selección o, si no hay, la lista filtrada
  const base = seleccion.length ? filas.filter((c) => seleccion.includes(c.id)) : filtrados;
  const destinatarios = base.filter((c) => c.wa);
  const sinNumero = base.length - destinatarios.length;
  const seleccionConWhatsapp = filas.filter((c) => seleccion.includes(c.id) && c.wa).length;

  const hayFiltros = Boolean(q) || filtro !== 'todos' || creador !== 'todos';
  const limpiar = () => { setTexto(''); setFiltro('todos'); setCreador('todos'); };

  const FILTROS = [
    { key: 'todos', label: 'Todos' },
    { key: 'whatsapp', label: 'Con WhatsApp' },
    { key: 'sin_whatsapp', label: 'Sin WhatsApp' },
    { key: 'correo', label: 'Con correo' },
    { key: 'nuevos', label: 'Nuevos este mes' },
  ];

  return (
    <Layout title="Clientes">
      <Head title="Clientes" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title={titulo ?? 'Clientes'}
          subtitle={subtitulo ?? 'Se registran solos al vender, reservar, cotizar o recibir un servicio técnico. Desde aquí corriges sus datos o les envías una promoción.'}
          actions={
            <button type="button" onClick={() => setPromo(true)} className={buttonCls('success', 'h-11 px-5')}>
              <MessageCircle className="h-4 w-4" /> Promoción por WhatsApp
            </button>
          }
        />

        {guia}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Users} label="Clientes" value={conteo.todos.toLocaleString('es-BO')} hint={`${conteo.nuevos} nuevos este mes`} />
          <Stat icon={MessageCircle} label="Con WhatsApp" value={conteo.whatsapp.toLocaleString('es-BO')} tone="emerald"
            hint={conteo.sin_whatsapp ? `${conteo.sin_whatsapp} sin número válido` : 'Todos con número válido'} />
          <Stat icon={Mail} label="Con correo" value={conteo.correo.toLocaleString('es-BO')} tone="lila"
            hint={conteo.todos ? `${Math.round((conteo.correo / conteo.todos) * 100)} % del total` : undefined} />
          <Stat icon={UserPlus} label="Nuevos este mes" value={conteo.nuevos.toLocaleString('es-BO')} tone="amber"
            hint={filas[0] ? `Último: ${filas[0].nombre}` : undefined} />
        </div>

        {/* Búsqueda y filtros */}
        <section className="rounded-2xl border border-gris-200 bg-white p-4 shadow-sutil">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar clientes"
                placeholder="Buscar por nombre, teléfono, correo o documento"
                className={`${inputCls} h-11 pl-10 pr-10`} />
              {texto && (
                <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {creadores.length > 1 && (
              <select value={creador} onChange={(e) => setCreador(e.target.value)} aria-label="Registrado por"
                className={`${inputCls} h-11 pr-9 lg:w-56`}>
                <option value="todos">Registrado por: todos</option>
                {creadores.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Orden" className={`${inputCls} h-11 pr-9 lg:w-48`}>
              <option value="recientes">Más recientes primero</option>
              <option value="nombre">Nombre (A–Z)</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar clientes">
            {FILTROS.map((fx) => (
              <button key={fx.key} type="button" onClick={() => setFiltro(fx.key)} aria-pressed={filtro === fx.key}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filtro === fx.key ? 'bg-carbon-900 text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                {fx.label} <span className={filtro === fx.key ? 'text-white/70' : 'text-gris-400'}>{conteo[fx.key].toLocaleString('es-BO')}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Listado */}
        <section ref={tablaRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-gris-200 bg-white shadow-sutil">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
              <Users className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Listado de clientes
            </h2>
            <div className="flex items-center gap-2">
              {visibles.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gris-600 md:hidden">
                  <input type="checkbox" checked={paginaMarcada} onChange={alternarPagina} className={checkCls} /> Esta página
                </label>
              )}
              {hayFiltros && (
                <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                  <X className="h-3.5 w-3.5" /> Quitar filtros
                </button>
              )}
            </div>
          </div>

          {clientes.length === 0 ? (
            <EmptyState icon={Users} title="Todavía no hay clientes"
              text="Se agregan solos cuando registras una venta, una reserva, una cotización o un servicio técnico." />
          ) : total === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro nombre o número, o quita los filtros."
              action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
          ) : (
            <>
              {/* Escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-[13px]">
                  <thead>
                    <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                      <th className="w-10 py-3 pl-5 pr-2">
                        <input type="checkbox" checked={paginaMarcada} onChange={alternarPagina} aria-label="Seleccionar esta página" className={checkCls} />
                      </th>
                      <th className="px-3 py-3">Cliente</th>
                      <th className="px-4 py-3">WhatsApp</th>
                      <th className="px-4 py-3">Correo</th>
                      {creadores.length > 1 && <th className="px-4 py-3">Registrado por</th>}
                      <th className="px-5 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {visibles.map((c) => {
                      const marcado = seleccion.includes(c.id);
                      return (
                        <tr key={c.id} className={`transition-colors ${marcado ? 'bg-[rgb(var(--acento-rgb)_/_0.06)]' : 'hover:bg-gris-50/70'}`}>
                          <td className="py-3 pl-5 pr-2">
                            <input type="checkbox" checked={marcado} onChange={() => alternar(c.id)} aria-label={`Seleccionar a ${c.nombre}`} className={checkCls} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-carbon-900/[0.07] text-xs font-bold text-carbon-900">{iniciales(c.nombre)}</span>
                              <div className="min-w-0">
                                <p className="max-w-[260px] truncate font-semibold text-gris-900">{c.nombre}</p>
                                <p className="text-xs text-gris-400">Desde {fechaCorta(c.created_at)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {c.telefono ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="tabular-nums text-gris-700">{c.telefono}</span>
                                {!c.wa && <Badge tone="amber">Revisar</Badge>}
                              </span>
                            ) : <span className="text-gris-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {c.correo ? <span className="max-w-[240px] truncate text-gris-700">{c.correo}</span> : <span className="text-gris-300">—</span>}
                          </td>
                          {creadores.length > 1 && <td className="px-4 py-3 text-gris-600">{c.usuario?.name || '—'}</td>}
                          <td className="px-5 py-3"><Acciones c={c} prefijo={prefijo} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Celular */}
              <ul className="divide-y divide-gris-100 md:hidden">
                {visibles.map((c) => {
                  const marcado = seleccion.includes(c.id);
                  return (
                    <li key={c.id} className={`flex items-center gap-3 px-4 py-3.5 ${marcado ? 'bg-[rgb(var(--acento-rgb)_/_0.06)]' : ''}`}>
                      <input type="checkbox" checked={marcado} onChange={() => alternar(c.id)} aria-label={`Seleccionar a ${c.nombre}`} className={checkCls} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gris-900">{c.nombre}</p>
                        <p className="truncate text-xs text-gris-500">{[c.telefono, c.correo].filter(Boolean).join(' · ') || 'Sin contacto'}</p>
                      </div>
                      <Acciones c={c} prefijo={prefijo} />
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <Paginador meta={meta} onPagina={irAPagina} porPagina={porPagina} onPorPagina={setPorPagina} />
        </section>

        {/* Acciones con los seleccionados */}
        {seleccion.length > 0 && (
          <div className="sticky bottom-4 z-30">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-carbon-900 px-5 py-3 text-white shadow-[0_18px_40px_-18px_rgba(10, 10, 11,0.8)]">
              <p className="text-sm font-bold">
                {seleccion.length} {seleccion.length === 1 ? 'seleccionado' : 'seleccionados'}
                <span className="font-normal text-white/70"> · {seleccionConWhatsapp} con WhatsApp</span>
              </p>
              {!todosFiltradosMarcados && total > visibles.length && (
                <button type="button" onClick={() => setSeleccion([...new Set([...seleccion, ...filtrados.map((c) => c.id)])])}
                  className="text-sm font-semibold text-white/80 underline-offset-2 hover:text-white hover:underline">
                  Seleccionar los {total.toLocaleString('es-BO')} de la lista
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setSeleccion([])}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                  Quitar selección
                </button>
                <button type="button" onClick={() => setPromo(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600">
                  <Sparkles className="h-4 w-4" /> Promoción a la selección
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {promo && (
        <PromoModal destinatarios={destinatarios} sinNumero={sinNumero} desdeSeleccion={seleccion.length > 0} onClose={() => setPromo(false)} />
      )}
    </Layout>
  );
}
