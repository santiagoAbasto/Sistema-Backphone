import { Head, Link, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { route } from 'ziggy-js';
import {
  ArrowRight, Boxes, CalendarCheck, Hammer, PlusCircle, Receipt, ShoppingCart, Tag, Wallet,
} from 'lucide-react';
import VendedorLayout from '@/Layouts/VendedorLayout';
import { Toast, bsFmt, buttonCls, useToast } from '@/Components/Admin/ui';
import { Metrica, Sparkline, TituloSeccion } from '@/Components/Panel/Metricas';
import Avatar from '@/Components/Panel/Avatar';
import {
  AccesoRapido, CONSEJOS_VENDEDOR, Entrada, ListaReciente, TarjetaMeta, animoDelDia,
} from '@/Components/Vendedor/dia';

/**
 * Mi día: lo primero que ve el vendedor.
 *
 * Todos los números son suyos. Acá no hay costo ni ganancia: ve el precio, el descuento que hizo
 * y lo que cobró (App\Http\Controllers\Vendedor\DashboardVendedorController).
 */

const fechaCorta = (iso) => (iso
  ? new Date(`${iso}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
  : '—');

const EASE = [0.22, 1, 0.36, 1];

/** Una línea del resumen del día. */
function Fila({ label, valor, detalle, fuerte = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gris-100 py-2.5 last:border-b-0">
      <span className="text-[13px] text-gris-500">
        {label}
        {detalle && <span className="ml-1.5 text-[11.5px] text-gris-400">{detalle}</span>}
      </span>
      <span className={`tabular-nums ${fuerte ? 'font-marca text-[16px] font-bold text-gris-900' : 'text-[14px] font-semibold text-gris-800'}`}>
        {valor}
      </span>
    </div>
  );
}

export default function Dashboard({ resumen = {}, serie = [], ultimasVentas = [], ultimasCotizaciones = [], ultimosServicios = [] }) {
  const { auth } = usePage().props;
  const [toast] = useToast();

  const usuario = auth?.user;
  const nombre = (usuario?.name ?? '').split(' ')[0] || 'vendedor';
  const sinMovimiento = !resumen.ventas_dia && !resumen.servicios_dia;
  const meta = Number(resumen.meta_mensual) || 0;
  const pct = meta > 0 ? Math.min(100, ((Number(resumen.total_mes) || 0) / meta) * 100) : null;
  const animo = animoDelDia({ ventas: resumen.ventas_dia, servicios: resumen.servicios_dia, pct });
  const IconoAnimo = animo.icon;

  const puntos = serie.map((d) => Number(d?.total) || 0);
  const mejorDia = serie.reduce((mejor, d) => ((Number(d?.total) || 0) > (Number(mejor?.total) || 0) ? d : mejor), null);

  return (
    <VendedorLayout title="Mi día">
      <Head title="Mi día" />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-6">
        {/* ── Portada ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="relative z-10 overflow-hidden rounded-[20px] p-6 lg:p-8"
          style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #171719 44%, #2A211A 100%)' }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(120% 90% at 12% 20%, #000 35%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(120% 90% at 12% 20%, #000 35%, transparent 100%)',
            }} />
          <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl"
            style={{ background: 'rgba(213, 179, 150, 0.16)' }} />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Avatar foto={usuario?.foto_url} iniciales={usuario?.iniciales ?? 'V'} nombre={usuario?.name} tamano="md"
                  className="ring-2 ring-white/10" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bronce-300">
                    {new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <h1 className="mt-1 font-marca text-[32px] font-bold leading-[1.05] tracking-tight text-white lg:text-[38px]">
                    Hola, {nombre}
                  </h1>
                </div>
              </div>

              <p className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-white/80">
                <IconoAnimo className="h-4 w-4 shrink-0 text-bronce-300" /> {animo.texto}
              </p>
            </div>

            {/* Lo cobrado hoy: el número que el vendedor mira primero */}
            <div className="shrink-0 rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-5 py-4 lg:min-w-[240px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Cobraste hoy</p>
              <p className="mt-1.5 font-marca text-[30px] font-bold leading-none tracking-tight tabular-nums text-white">
                {bsFmt(resumen.cobrado_dia)}
              </p>
              {puntos.length > 1 && (
                <div className="mt-3 -mb-1">
                  <Sparkline puntos={puntos} tono="acento" className="h-8 w-full" />
                </div>
              )}
            </div>
          </div>

          <div className="relative mt-7 flex flex-wrap gap-2.5">
            <Link href={route('vendedor.ventas.create')}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-bronce-400 px-4 text-sm font-semibold text-carbon-950 transition-colors hover:bg-bronce-300">
              <PlusCircle className="h-[18px] w-[18px]" /> Registrar venta
            </Link>
            <Link href={route('vendedor.servicios.create')}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-white/[0.12] bg-white/[0.06] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]">
              <Hammer className="h-[18px] w-[18px]" /> Nuevo servicio
            </Link>
            <Link href={route('vendedor.productos.index')}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-white/[0.12] bg-white/[0.06] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]">
              <Boxes className="h-[18px] w-[18px]" /> Ver stock
            </Link>
          </div>
        </motion.section>

        {/* ── Hoy ── */}
        <div>
          <TituloSeccion extra={<span className="text-[12px] font-medium text-gris-400">Hoy</span>}>
            Tus números del día
          </TituloSeccion>

          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Metrica etiqueta="Ventas" valor={(resumen.ventas_dia ?? 0).toLocaleString('es-BO')} icono={ShoppingCart}
              hint={`${resumen.servicios_dia ?? 0} ${resumen.servicios_dia === 1 ? 'servicio técnico' : 'servicios técnicos'}`} />
            <Metrica etiqueta="Vendido" valor={bsFmt(resumen.bruto_dia)} icono={Wallet} tono="acento"
              hint="Precio con tu descuento aplicado" />
            <Metrica etiqueta="Descuentos que hiciste" valor={bsFmt(resumen.descuentos_dia)} icono={Tag}
              tono={Number(resumen.descuentos_dia) > 0 ? 'aviso' : 'neutro'}
              hint="Lo que rebajaste del precio de lista" />
            <Metrica etiqueta="Reservas activas" valor={(resumen.reservas_activas ?? 0).toLocaleString('es-BO')}
              icono={CalendarCheck} hint="Clientes que dejaron seña" />
          </div>
        </div>

        {/* ── El día y la meta ── */}
        <div className="grid items-start gap-5 lg:grid-cols-3">
          <Entrada i={0} className="lg:col-span-2">
            <section className="h-full rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-gris-900">Cómo cerró el día</h2>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-gris-500">
                    «Vendido» es el precio con tu descuento ya aplicado. «Cobrado» es lo que el cliente
                    pagó hoy, sin permutas ni señas de antes.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Fila label="Vendido" valor={bsFmt(resumen.bruto_dia)} />
                <Fila label="Cobrado" detalle="entró en caja" valor={bsFmt(resumen.cobrado_dia)} fuerte />
                <Fila label="Descuentos que hiciste" valor={bsFmt(resumen.descuentos_dia)} />
                <Fila label="Cotizaciones" valor={(resumen.cotizaciones_dia ?? 0).toLocaleString('es-BO')} />
                <Fila label="Acumulado del mes" valor={bsFmt(resumen.total_mes)} fuerte />
              </div>

              {sinMovimiento ? (
                <p className="mt-4 rounded-[10px] bg-gris-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-gris-600">
                  Todavía no registraste nada hoy. En cuanto cargues la primera venta o el primer
                  servicio, estos números se mueven solos.
                </p>
              ) : puntos.length > 1 && (
                <div className="mt-5 border-t border-gris-100 pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gris-500">Tus últimos 14 días</p>
                    {mejorDia && Number(mejorDia.total) > 0 && (
                      <p className="text-[12px] text-gris-500">
                        Tu mejor día: <span className="font-semibold text-gris-800">{fechaCorta(mejorDia.fecha)}</span>
                        {' · '}<span className="tabular-nums">{bsFmt(mejorDia.total)}</span>
                      </p>
                    )}
                  </div>
                  <Sparkline puntos={puntos} tono="acento" className="mt-2 h-14 w-full" />
                </div>
              )}
            </section>
          </Entrada>

          <TarjetaMeta total={resumen.total_mes ?? 0} meta={meta} mes={resumen.mes ?? ''} />
        </div>

        {/* ── Accesos rápidos ── */}
        <section>
          <TituloSeccion>Lo que más usás</TituloSeccion>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AccesoRapido i={0} href={route('vendedor.ventas.create')} icon={PlusCircle} label="Registrar venta" hint="Con permuta, seña o descuento" />
            <AccesoRapido i={1} href={route('vendedor.servicios.create')} icon={Hammer} label="Nuevo servicio" hint="Deja la nota lista para imprimir" />
            <AccesoRapido i={2} href={route('vendedor.cotizaciones.create')} icon={Receipt} label="Cotizar" hint="Se envía por WhatsApp o correo" />
            <AccesoRapido i={3} href={route('vendedor.reservas.create')} icon={CalendarCheck} label="Tomar una reserva" hint="Guarda la seña del cliente" />
          </div>
        </section>

        {/* ── Lo último que registraste ── */}
        <div>
          <TituloSeccion
            extra={
              <Link href={route('vendedor.ventas.index')}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--acento)] hover:text-carbon-900">
                Ver todas mis ventas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            Lo último que registraste
          </TituloSeccion>

          <div className="grid gap-5 lg:grid-cols-3">
            <ListaReciente
              i={0} icon={ShoppingCart} titulo="Ventas" verTodo={route('vendedor.ventas.index')}
              items={ultimasVentas} vacio="Todavía no registraste ninguna venta."
              render={(v) => (
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-gris-800">{v.cliente || 'Sin nombre'}</span>
                    <span className="block truncate text-[11px] text-gris-400">
                      <span className="cifra">{v.codigo || '—'}</span> · {fechaCorta(v.fecha)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-gris-900">{bsFmt(v.total)}</span>
                </>
              )}
            />

            <ListaReciente
              i={1} icon={Receipt} titulo="Cotizaciones" verTodo={route('vendedor.cotizaciones.index')}
              items={ultimasCotizaciones} vacio="Todavía no hiciste ninguna cotización."
              render={(c) => (
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-gris-800">{c.cliente || 'Sin nombre'}</span>
                    <span className="block text-[11px] text-gris-400">{fechaCorta(c.fecha)}</span>
                  </span>
                  <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-gris-900">{bsFmt(c.total)}</span>
                </>
              )}
            />

            <ListaReciente
              i={2} icon={Hammer} titulo="Servicios" verTodo={route('vendedor.servicios.index')}
              items={ultimosServicios} vacio="Todavía no registraste ningún servicio."
              render={(s) => (
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-gris-800">{s.equipo || 'Equipo'}</span>
                    <span className="block truncate text-[11px] text-gris-400">{s.cliente || 'Sin nombre'} · {fechaCorta(s.fecha)}</span>
                  </span>
                  <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-gris-900">{bsFmt(s.total)}</span>
                </>
              )}
            />
          </div>
        </div>

        {/* ── Consejos ── */}
        <Entrada i={1}>
          <section className="rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil">
            <h2 className="text-[15px] font-semibold text-gris-900">Para que el día salga redondo</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {CONSEJOS_VENDEDOR.map((c, i) => (
                <li key={i}
                  className="flex items-start gap-2.5 rounded-[10px] bg-gris-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-gris-600 transition-colors hover:bg-[rgb(var(--acento-rgb)_/_0.06)]">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-carbon-900 font-marca text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </section>
        </Entrada>
      </div>

      <Toast toast={toast} />
    </VendedorLayout>
  );
}
