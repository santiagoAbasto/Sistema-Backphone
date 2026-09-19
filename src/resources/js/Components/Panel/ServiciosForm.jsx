import { Head, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { route } from 'ziggy-js';
import { ArrowLeft, Hammer, Plus, Trash2, Wrench } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Badge, Field, Input, StepCard, Textarea, bsFmt, buttonCls } from '@/Components/Admin/ui';

let ultimoId = 0;
const nuevoTrabajo = () => ({ id: ++ultimoId, descripcion: '', costo: '', precio: '' });
const monto = (v) => Math.round((Number(v) || 0) * 100) / 100;

function Linea({ label, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gris-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-gris-900">{valor || '—'}</dd>
    </div>
  );
}

export default function ServiciosForm({ tecnicos = [], Layout, prefijo = 'admin' }) {
  // El vendedor registra solo lo que paga el cliente: con eso sale la nota. El costo de cada trabajo lo carga
  // el administrador desde la lista (le llega el aviso), y recién ahí se calcula la utilidad.
  const conMargen = prefijo === 'admin';
  const [data, setData] = useState({
    cliente: '',
    telefono: '',
    equipo: '',
    tecnico: '',
    fecha: dayjs().format('YYYY-MM-DD'), // fecha local (no UTC)
    notas_adicionales: '',
  });
  const [trabajos, setTrabajos] = useState(() => [nuevoTrabajo()]);
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [notice, setNotice] = useState(null);
  const ultimaBusqueda = useRef('');

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });
  const quitarError = (clave) => setErrores((e) => {
    if (!e[clave]) return e;
    const { [clave]: _omitido, ...resto } = e;
    return resto;
  });
  const cambiar = (campo, valor) => {
    setData((d) => ({ ...d, [campo]: valor }));
    quitarError(campo);
  };

  /* Cliente: sugerencias mientras escribe */
  const buscarCliente = async (valor) => {
    cambiar('cliente', valor);
    ultimaBusqueda.current = valor;
    if (valor.trim().length < 2) {
      setMostrarSugerencias(false);
      return;
    }
    try {
      const res = await axios.get(route(`${prefijo}.clientes.sugerencias`, { term: valor.trim() }));
      if (ultimaBusqueda.current !== valor) return; // respuesta vieja: ya escribió otra cosa
      setSugerencias(Array.isArray(res.data) ? res.data : []);
      setMostrarSugerencias(true);
    } catch {
      setMostrarSugerencias(false);
    }
  };

  const elegirCliente = (c) => {
    setData((d) => ({ ...d, cliente: c.nombre, telefono: c.telefono || d.telefono }));
    quitarError('cliente');
    setMostrarSugerencias(false);
  };

  /* Trabajos */
  const cambiarTrabajo = (id, campo, valor) => {
    setTrabajos((ts) => ts.map((t) => (t.id === id ? { ...t, [campo]: valor } : t)));
    quitarError(`trabajo.${id}`);
    quitarError('trabajos');
  };
  const quitarTrabajo = (id) => setTrabajos((ts) => (ts.length === 1 ? [nuevoTrabajo()] : ts.filter((t) => t.id !== id)));
  const agregarTrabajo = () => setTrabajos((ts) => [...ts, nuevoTrabajo()]);

  const descritos = trabajos.filter((t) => t.descripcion.trim());
  const totalCosto = monto(trabajos.reduce((a, t) => a + monto(t.costo), 0));
  const totalCobro = monto(trabajos.reduce((a, t) => a + monto(t.precio), 0));
  const ganancia = monto(totalCobro - totalCosto);

  const sinCosto = conMargen ? descritos.filter((t) => t.costo === '').length : 0;

  const validar = () => {
    const e = {};
    if (!data.cliente.trim()) e.cliente = 'Escribe el nombre del cliente.';
    if (!data.equipo.trim()) e.equipo = 'Indica qué equipo deja el cliente.';
    if (!data.tecnico.trim()) e.tecnico = 'Indica quién hace el trabajo.';
    if (!data.fecha) e.fecha = 'Elige la fecha.';
    trabajos.forEach((t) => {
      if (!t.descripcion.trim() && (t.costo !== '' || t.precio !== '')) e[`trabajo.${t.id}`] = 'Describe este trabajo.';
      else if (t.descripcion.trim() && t.precio === '') e[`trabajo.${t.id}`] = 'Escribe cuánto paga el cliente por este trabajo.';
      else if (Number(t.costo) < 0 || Number(t.precio) < 0) e[`trabajo.${t.id}`] = 'Los montos no pueden ser negativos.';
    });
    if (descritos.length === 0) e.trabajos = 'Agrega al menos un trabajo.';
    return e;
  };

  const registrar = () => {
    if (guardando) return;
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    // Un costo vacío no es cero: el servicio queda con el costo pendiente (del vendedor nunca viaja el costo)
    const detalle = descritos.map((t) => ({
      descripcion: t.descripcion.trim(),
      ...(conMargen && t.costo !== '' ? { costo: monto(t.costo) } : {}),
      precio: monto(t.precio),
    }));

    router.post(route(`${prefijo}.servicios.store`), {
      cliente: data.cliente.trim(),
      telefono: data.telefono.trim(),
      equipo: data.equipo.trim(),
      tecnico: data.tecnico.trim(),
      fecha: data.fecha,
      notas_adicionales: data.notas_adicionales.trim(),
      detalle_servicio: JSON.stringify(detalle),
      ...(conMargen && sinCosto === 0 ? { precio_costo: monto(detalle.reduce((a, t) => a + (t.costo ?? 0), 0)) } : {}),
      precio_venta: monto(detalle.reduce((a, t) => a + t.precio, 0)),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(true),
      onSuccess: () => notifyRecordsUpdated(),
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo registrar el servicio', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(false),
    });
  };

  const mensajes = [...new Set(Object.values(errores).flat())];

  return (
    <Layout title="Nuevo servicio técnico">
      <Head title="Nuevo servicio técnico" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route(`${prefijo}.servicios.index`)} aria-label="Volver a servicios"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-[#121214]" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Nuevo servicio técnico
            </h1>
            <p className="text-sm text-gris-500">Registra la reparación: cliente, equipo, técnico y lo que se cobra.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Paso 1 */}
            <StepCard step={1} title="Cliente" subtitle="Escribe el nombre: si ya vino antes, aparece para elegirlo.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Field label="Nombre del cliente" error={errores.cliente}>
                    <Input
                      value={data.cliente}
                      placeholder="Ej.: María Rojas"
                      autoComplete="off"
                      onChange={(e) => buscarCliente(e.target.value)}
                      onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
                    />
                  </Field>
                  {mostrarSugerencias && sugerencias.length > 0 && (
                    <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gris-200 bg-white text-sm shadow-xl">
                      {sugerencias.map((c) => (
                        <li key={c.id ?? `${c.nombre}-${c.telefono}`}>
                          <button type="button" className="block w-full px-4 py-2.5 text-left hover:bg-gris-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => elegirCliente(c)}>
                            <span className="block font-semibold text-gris-900">{c.nombre}</span>
                            {c.telefono && <span className="text-xs text-gris-500">{c.telefono}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Field label="Teléfono" error={errores.telefono} hint="Para avisarle cuando el equipo esté listo.">
                  <Input value={data.telefono} placeholder="Ej.: 70000000" inputMode="tel"
                    onChange={(e) => cambiar('telefono', e.target.value)} />
                </Field>
              </div>
            </StepCard>

            {/* Paso 2 */}
            <StepCard step={2} title="Equipo y técnico" subtitle="Qué equipo deja el cliente y quién hará el trabajo.">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                <Field label="Equipo" error={errores.equipo}>
                  <Input value={data.equipo} placeholder="Ej.: iPhone 13 Pro Max"
                    onChange={(e) => cambiar('equipo', e.target.value)} />
                </Field>
                <Field label="Fecha" error={errores.fecha}>
                  <Input type="date" value={data.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Técnico" error={errores.tecnico}>
                  <Input value={data.tecnico} placeholder="Nombre de quien repara el equipo"
                    onChange={(e) => cambiar('tecnico', e.target.value)} />
                </Field>
                {tecnicos.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-gris-400">Anteriores:</span>
                    {tecnicos.slice(0, 10).map((t) => (
                      <button key={t} type="button" onClick={() => cambiar('tecnico', t)} aria-pressed={data.tecnico === t}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${data.tecnico === t ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                        <Wrench className="h-3 w-3" /> {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </StepCard>

            {/* Paso 3 */}
            <StepCard step={3} title="Trabajos a realizar"
              subtitle={conMargen
                ? 'Cada trabajo con su costo y lo que paga el cliente. Si todavía no sabes el costo, déjalo vacío y lo cargas después desde la lista.'
                : 'Cada trabajo con lo que paga el cliente. El costo lo carga el administrador.'}
              actions={<Badge tone="navy">{descritos.length} {descritos.length === 1 ? 'trabajo' : 'trabajos'}</Badge>}>
              <div className={`mb-2 hidden gap-2.5 px-[13px] text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400 md:grid ${conMargen ? 'grid-cols-[32px_minmax(0,1fr)_132px_152px_40px]' : 'grid-cols-[32px_minmax(0,1fr)_152px_40px]'}`}>
                <span>#</span><span>Trabajo</span>{conMargen && <span>Costo (Bs)</span>}<span>Cobro al cliente</span><span />
              </div>

              <ul className="space-y-2">
                {trabajos.map((t, i) => {
                  const costo = monto(t.costo);
                  const precio = monto(t.precio);
                  const error = errores[`trabajo.${t.id}`];
                  const bajoCosto = conMargen && t.costo !== '' && t.precio !== '' && precio < costo;
                  const aviso = error || (bajoCosto ? `Se cobra ${bsFmt(costo - precio)} menos de lo que cuesta.` : null);
                  return (
                    <li key={t.id} className={`rounded-xl border p-3 transition-colors ${error ? 'border-rose-300 bg-rose-50/40' : 'border-gris-200 bg-white'}`}>
                      <div className={`grid items-center gap-2.5 ${conMargen
                        ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] md:grid-cols-[32px_minmax(0,1fr)_132px_152px_40px]'
                        : 'grid-cols-[minmax(0,1fr)_40px] md:grid-cols-[32px_minmax(0,1fr)_152px_40px]'}`}>
                        <span className="hidden h-8 w-8 place-items-center rounded-lg bg-gris-100 text-xs font-bold text-gris-500 md:grid">{i + 1}</span>
                        <Input className={conMargen ? 'col-span-3 md:col-span-1' : 'col-span-2 md:col-span-1'} value={t.descripcion} aria-label={`Trabajo ${i + 1}`}
                          placeholder={i === 0 ? 'Ej.: Cambio de batería' : 'Describe el trabajo'}
                          onChange={(e) => cambiarTrabajo(t.id, 'descripcion', e.target.value)} />
                        {conMargen && (
                          <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Costo" aria-label={`Costo del trabajo ${i + 1}`}
                            className="tabular-nums" value={t.costo} onChange={(e) => cambiarTrabajo(t.id, 'costo', e.target.value)} />
                        )}
                        <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Cobro al cliente" aria-label={`Cobro al cliente del trabajo ${i + 1}`}
                          className="font-semibold tabular-nums" value={t.precio} onChange={(e) => cambiarTrabajo(t.id, 'precio', e.target.value)} />
                        <button type="button" onClick={() => quitarTrabajo(t.id)} aria-label={`Quitar trabajo ${i + 1}`} title="Quitar"
                          className="grid h-10 w-10 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {aviso && (
                        <p className={`mt-2 text-xs md:pl-[42px] ${error ? 'font-semibold text-rose-600' : 'text-amber-700'}`}>{aviso}</p>
                      )}
                    </li>
                  );
                })}
              </ul>

              <button type="button" onClick={agregarTrabajo}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gris-300 text-sm font-semibold text-gris-600 transition-colors hover:border-[color:var(--acento)] hover:bg-[rgb(var(--acento-rgb)_/_0.04)] hover:text-[#121214]">
                <Plus className="h-4 w-4" /> Agregar otro trabajo
              </button>
              {errores.trabajos && <p className="mt-2 text-xs font-semibold text-rose-600">{errores.trabajos}</p>}
            </StepCard>

            {/* Paso 4 */}
            <StepCard step={4} title="Notas" subtitle="Opcional. Estado del equipo, accesorios que deja o recomendaciones.">
              <Textarea rows={3} value={data.notas_adicionales} placeholder="Ej.: Llega con la pantalla rayada; deja el cargador."
                onChange={(e) => cambiar('notas_adicionales', e.target.value)} />
              <p className="mt-1.5 text-[11px] text-gris-500">Aparecen en el recibo térmico.</p>
            </StepCard>
          </div>

          {/* Resumen */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <Hammer className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen del servicio
                </h2>
                <Badge tone="navy">{descritos.length} {descritos.length === 1 ? 'trabajo' : 'trabajos'}</Badge>
              </div>

              <div className="space-y-4 p-5">
                <dl className="space-y-1.5 text-sm">
                  <Linea label="Cliente" valor={data.cliente.trim()} />
                  <Linea label="Equipo" valor={data.equipo.trim()} />
                  <Linea label="Técnico" valor={data.tecnico.trim()} />
                </dl>

                {descritos.length > 0 && (
                  <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-gris-100 pt-4">
                    {descritos.map((t) => (
                      <li key={`r-${t.id}`} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-gris-600">{t.descripcion}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-gris-900">{bsFmt(t.precio)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {conMargen && (
                  <dl className="space-y-1.5 border-t border-gris-100 pt-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gris-500">Costo de los trabajos</dt>
                      <dd className="font-semibold tabular-nums text-gris-900">{sinCosto > 0 ? 'Pendiente' : bsFmt(totalCosto)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gris-500">Ganancia</dt>
                      {sinCosto > 0 ? (
                        <dd className="font-semibold text-gris-400">Al cargar el costo</dd>
                      ) : (
                        <dd className={`font-semibold tabular-nums ${ganancia < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {ganancia < 0 ? '−' : '+'}{bsFmt(Math.abs(ganancia))}
                        </dd>
                      )}
                    </div>
                  </dl>
                )}

                <div className="rounded-xl bg-[#121214] px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">El cliente paga</p>
                  <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight">{bsFmt(totalCobro)}</p>
                  <p className="mt-1.5 text-xs text-white/60">Es el total que aparece en la nota.</p>
                </div>

                {!conMargen && (
                  <p className="rounded-xl bg-gris-50 px-4 py-3 text-xs leading-relaxed text-gris-600">
                    Al registrarlo sale la nota para el cliente. El costo del trabajo lo carga el administrador para calcular la utilidad.
                  </p>
                )}

                {mensajes.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <p className="mb-1 font-semibold">Revisa estos datos:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {mensajes.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                )}

                <button type="button" onClick={registrar} disabled={guardando}
                  className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  {guardando ? 'Guardando…' : 'Registrar servicio'}
                </button>
                <p className="text-center text-xs text-gris-400">Al guardar vuelves al listado, donde imprimes la nota.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
