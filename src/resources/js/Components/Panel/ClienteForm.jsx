import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import {
  ArrowLeft, CalendarCheck, ChevronRight, ExternalLink, FileText, Hammer, Mail, MessageCircle, Receipt, ShoppingCart, User,
} from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { Field, Input, StepCard, bsFmt, buttonCls } from '@/Components/Admin/ui';

const TZ = 'America/La_Paz';

const digitos = (t) => String(t ?? '').replace(/\D/g, '');
// Número para WhatsApp: con código de país; los de 8 dígitos que empiezan con 6 o 7 son celulares de Bolivia
const numeroWhatsapp = (tel) => {
  const d = digitos(tel);
  if (d.length === 8 && /^[67]/.test(d)) return `591${d}`;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
};
const correoValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const fmtFecha = (v, largo = false) => {
  if (!v) return '—';
  const opciones = largo ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-BO', opciones);
  }
  return new Date(v).toLocaleDateString('es-BO', { ...opciones, timeZone: TZ });
};

const MOVIMIENTOS = {
  venta: { icon: ShoppingCart, tone: 'bg-[#121214]/[0.07] text-[#121214]' },
  servicio: { icon: Hammer, tone: 'bg-emerald-50 text-emerald-700' },
  cotizacion: { icon: FileText, tone: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]' },
  reserva: { icon: CalendarCheck, tone: 'bg-amber-50 text-amber-700' },
};

function Linea({ label, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gris-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-gris-900">{valor || '—'}</dd>
    </div>
  );
}

function Cifra({ icon: Icon, label, valor, extra }) {
  return (
    <div className="rounded-xl border border-gris-100 bg-gris-50/60 px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gris-500"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className="mt-1.5 text-xl font-extrabold leading-none tabular-nums text-gris-900">{valor}</p>
      {extra && <p className="mt-1 truncate text-xs tabular-nums text-gris-500">{extra}</p>}
    </div>
  );
}

export default function ClienteForm({ cliente, actividad = {}, Layout, prefijo = 'admin' }) {
  const original = {
    nombre: cliente.nombre || '',
    telefono: cliente.telefono || '',
    correo: cliente.correo || '',
    documento: cliente.documento || '',
  };
  const [data, setData] = useState(original);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [notice, setNotice] = useState(null);

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });
  const cambiar = (campo, valor) => {
    setData((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => {
      if (!e[campo]) return e;
      const { [campo]: _omitido, ...resto } = e;
      return resto;
    });
  };

  const hayCambios = Object.keys(original).some((k) => data[k] !== original[k]);
  const wa = numeroWhatsapp(data.telefono);
  const correo = data.correo.trim();
  const ventas = actividad.ventas ?? { cantidad: 0, total: 0, ultima: null };
  const recientes = actividad.recientes ?? [];

  const validar = () => {
    const e = {};
    if (!data.nombre.trim()) e.nombre = 'Escribe el nombre del cliente.';
    if (!data.telefono.trim()) e.telefono = 'Escribe el teléfono del cliente.';
    else if (data.telefono.trim().length < 7) e.telefono = 'El teléfono parece incompleto.';
    if (correo && !correoValido(correo)) e.correo = 'Revisa el correo.';
    if (data.documento.trim().length > 30) e.documento = 'El documento puede tener hasta 30 caracteres.';
    return e;
  };

  const guardar = (ev) => {
    ev.preventDefault();
    if (guardando || !hayCambios) return;
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por corregir.');
      return;
    }
    router.put(route(`${prefijo}.clientes.update`, cliente.id), {
      nombre: data.nombre.trim(),
      telefono: data.telefono.trim(),
      correo,
      documento: data.documento.trim(),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(true),
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo guardar', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(false),
    });
  };

  return (
    <Layout title={`Editar cliente · ${cliente.nombre}`}>
      <Head title={`Editar cliente · ${cliente.nombre}`} />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route(`${prefijo}.clientes.index`)} aria-label="Volver a clientes"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[32px] font-extrabold leading-tight tracking-tight text-[#121214]" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Editar cliente
            </h1>
            <p className="text-sm text-gris-500">Sus datos de contacto se usan en ventas, cotizaciones y promociones.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Datos */}
            <form onSubmit={guardar} noValidate>
              <StepCard icon={User} title="Datos de contacto" subtitle="El nombre y el teléfono son obligatorios.">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="Nombre completo" error={errores.nombre}>
                      <Input value={data.nombre} maxLength={255} autoComplete="off" onChange={(e) => cambiar('nombre', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Teléfono / WhatsApp" error={errores.telefono}
                    hint={wa ? null : 'Con código de país (por ejemplo +591 70000000) para poder escribirle por WhatsApp.'}>
                    <Input type="tel" inputMode="tel" value={data.telefono} maxLength={20} placeholder="+591 70000000"
                      onChange={(e) => cambiar('telefono', e.target.value)} />
                    {wa && (
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                        <MessageCircle className="h-3.5 w-3.5" /> Listo para WhatsApp: +{wa}
                      </p>
                    )}
                  </Field>
                  <Field label="Correo (opcional)" error={errores.correo} hint="Para enviarle cotizaciones en PDF.">
                    <Input type="email" value={data.correo} maxLength={255} placeholder="nombre@correo.com" autoComplete="off"
                      onChange={(e) => cambiar('correo', e.target.value)} />
                  </Field>
                  <Field label="CI o NIT (opcional)" error={errores.documento}>
                    <Input value={data.documento} maxLength={30} autoComplete="off" onChange={(e) => cambiar('documento', e.target.value)} />
                  </Field>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-gris-100 pt-5">
                  {hayCambios && <span className="mr-auto text-xs font-semibold text-amber-700">Tienes cambios sin guardar.</span>}
                  <Link href={route(`${prefijo}.clientes.index`)} className={buttonCls('secondary', 'h-11 px-5')}>Cancelar</Link>
                  <button type="submit" disabled={guardando || !hayCambios} className={buttonCls('primary', 'h-11 px-6')}>
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </StepCard>
            </form>

            {/* Actividad */}
            <section className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]"><Receipt className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-base font-bold text-gris-900">Actividad del cliente</h2>
                  <p className="mt-0.5 text-[13px] text-gris-500">Compras, servicios técnicos, cotizaciones y reservas registradas con sus datos.</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Cifra icon={ShoppingCart} label="Compras" valor={ventas.cantidad} extra={ventas.cantidad ? bsFmt(ventas.total) : null} />
                <Cifra icon={Hammer} label="Servicios técnicos" valor={actividad.servicios ?? 0} />
                <Cifra icon={FileText} label="Cotizaciones" valor={actividad.cotizaciones ?? 0} />
                <Cifra icon={CalendarCheck} label="Reservas" valor={actividad.reservas ?? 0} />
              </div>
              {ventas.ultima && <p className="mt-3 text-xs text-gris-500">Última compra: {fmtFecha(ventas.ultima, true)}</p>}

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-gris-400">Movimientos recientes</h3>
              {recientes.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-gris-200 bg-gris-50/60 px-4 py-8 text-center text-sm text-gris-500">
                  Todavía no hay movimientos con este cliente.
                </div>
              ) : (
                <ul className="mt-2 divide-y divide-gris-100">
                  {recientes.map((m, i) => {
                    const tipo = MOVIMIENTOS[m.tipo] ?? MOVIMIENTOS.venta;
                    const Icon = tipo.icon;
                    const contenido = (
                      <>
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tipo.tone}`}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gris-900">
                            {m.titulo} {m.codigo && <span className="font-mono text-[color:var(--acento)]">{m.codigo}</span>}
                          </span>
                          <span className="block truncate text-xs text-gris-500">{fmtFecha(m.fecha)}{m.detalle ? ` · ${m.detalle}` : ''}</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-gris-900">{bsFmt(m.monto)}</span>
                        {m.externo
                          ? <ExternalLink className="h-4 w-4 shrink-0 text-gris-300 transition-colors group-hover:text-gris-600" />
                          : <ChevronRight className="h-4 w-4 shrink-0 text-gris-300 transition-colors group-hover:text-gris-600" />}
                      </>
                    );
                    const cls = 'group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gris-50';
                    return (
                      <li key={`${m.tipo}-${m.codigo}-${i}`}>
                        {m.externo
                          ? <a href={m.url} target="_blank" rel="noopener noreferrer" className={cls} title="Abrir el documento">{contenido}</a>
                          : <Link href={m.url} className={cls} title="Ver la venta">{contenido}</Link>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-gris-400">Las ventas y reservas se encuentran por el número de teléfono.</p>
            </section>
          </div>

          {/* Perfil */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#121214] text-base font-bold text-white">
                  {iniciales(data.nombre || cliente.nombre)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gris-900">{data.nombre.trim() || cliente.nombre}</p>
                  <p className="text-xs text-gris-500">Cliente desde {fmtFecha(cliente.created_at, true)}</p>
                </div>
              </div>

              <dl className="mt-5 space-y-1.5 border-t border-gris-100 pt-4 text-sm">
                <Linea label="Registrado por" valor={cliente.usuario?.name} />
                <Linea label="Teléfono" valor={data.telefono.trim()} />
                <Linea label="Correo" valor={correo} />
                <Linea label="CI o NIT" valor={data.documento.trim()} />
              </dl>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {wa ? (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={buttonCls('success', 'h-10')}>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                ) : (
                  <span title="Sin número de WhatsApp válido" className={buttonCls('secondary', 'h-10 cursor-not-allowed opacity-50')}>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </span>
                )}
                {correo && correoValido(correo) ? (
                  <a href={`mailto:${correo}`} className={buttonCls('secondary', 'h-10')}>
                    <Mail className="h-4 w-4" /> Correo
                  </a>
                ) : (
                  <span title="Sin correo" className={buttonCls('secondary', 'h-10 cursor-not-allowed opacity-50')}>
                    <Mail className="h-4 w-4" /> Correo
                  </span>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
