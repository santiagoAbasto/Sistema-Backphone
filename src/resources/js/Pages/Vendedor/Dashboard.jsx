import VendedorLayout from '@/Layouts/VendedorLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { motion } from 'framer-motion';
import {
  Boxes, CalendarCheck, Hammer, PlusCircle, Receipt, ShoppingCart, Tag, TrendingUp, Wallet,
} from 'lucide-react';
import { PageHeader, Toast, bsFmt, buttonCls, useToast } from '@/Components/Admin/ui';
import AdminGuide from '@/Components/Admin/AdminGuide';
import {
  AccesoRapido, CONSEJOS_VENDEDOR, Entrada, ListaReciente, Numero, TarjetaMeta, animoDelDia, useEntrada,
} from '@/Components/Vendedor/dia';

// Mi día: lo primero que ve el vendedor. Todos los números son suyos. Acá no hay costo ni
// ganancia: ve el precio, el descuento que hizo y lo que cobró
// (App\Http\Controllers\Vendedor\DashboardVendedorController).

const fechaCorta = (iso) => (iso
  ? new Date(`${iso}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
  : '—');

function Fila({ label, valor, tono = 'slate' }) {
  const tonos = {
    slate: 'text-gris-900',
    emerald: 'text-emerald-700',
    lila: 'text-[color:var(--acento)]',
  };
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gris-100 py-2.5 last:border-b-0">
      <span className="text-[13px] text-gris-500">{label}</span>
      <span className={`text-[15px] font-bold tabular-nums ${tonos[tono]}`}>{valor}</span>
    </div>
  );
}

export default function Dashboard({ resumen = {}, ultimasVentas = [], ultimasCotizaciones = [], ultimosServicios = [] }) {
  const { auth } = usePage().props;
  const [toast] = useToast();
  const entra = useEntrada();

  const nombre = (auth?.user?.name ?? '').split(' ')[0] || 'vendedor';
  const sinMovimiento = !resumen.ventas_dia && !resumen.servicios_dia;
  const meta = Number(resumen.meta_mensual) || 0;
  const pct = meta > 0 ? Math.min(100, ((Number(resumen.total_mes) || 0) / meta) * 100) : null;
  const animo = animoDelDia({ ventas: resumen.ventas_dia, servicios: resumen.servicios_dia, pct });
  const IconoAnimo = animo.icon;

  return (
    <VendedorLayout title="Mi día">
      <Head title="Mi día" />

      <div className="ab-reset space-y-5">
        <Entrada>
          <PageHeader
            title={`Hola, ${nombre}`}
            subtitle="Esto es lo tuyo de hoy: lo que vendiste, lo que cobraste y cuánto te falta para la meta del mes."
            actions={(
              <>
                <Link href={route('vendedor.productos.index')} className={buttonCls('secondary', 'h-11')}>
                  <Boxes className="h-4 w-4" /> Ver stock
                </Link>
                <Link href={route('vendedor.ventas.create')} className={buttonCls('primary', 'h-11')}>
                  <PlusCircle className="h-4 w-4" /> Registrar venta
                </Link>
              </>
            )}
          />

          {/* Cómo viene el día, en una línea */}
          <motion.p
            initial={entra ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--acento-rgb)_/_0.08)] px-3.5 py-2 text-[13px] font-semibold text-[color:var(--acento)]"
          >
            <IconoAnimo className="h-4 w-4 shrink-0" /> {animo.texto}
          </motion.p>
        </Entrada>

        <Entrada i={1}>
          <AdminGuide
            id="vendedor-dia"
            title="¿Cómo funciona tu panel?"
            steps={[
              'Arriba están tus números de hoy: cuántas ventas hiciste, cuánto entró en caja y cuánto rebajaste.',
              'La tarjeta morada es tu meta del mes. La carga el administrador y se actualiza sola con cada venta y cada servicio.',
              'Abajo tienes lo último que registraste, para volver a una nota sin tener que buscarla.',
            ]}
            tip="Los números del día se cuentan por la fecha de la venta, no por la hora en que la cargaste."
          >
            Todo lo que ves acá es tuyo
          </AdminGuide>
        </Entrada>

        {/* Números del día */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Numero i={0} icon={ShoppingCart} tone="navy" label="Ventas de hoy" valor={resumen.ventas_dia ?? 0}
            hint={`${resumen.servicios_dia ?? 0} servicio${resumen.servicios_dia === 1 ? '' : 's'} técnico${resumen.servicios_dia === 1 ? '' : 's'}`} />
          <Numero i={1} icon={Wallet} tone="emerald" label="Cobrado hoy" valor={resumen.cobrado_dia} moneda
            hint="Lo que el cliente pagó hoy" />
          <Numero i={2} icon={Tag} tone="lila" label="Descuentos que hiciste" valor={resumen.descuentos_dia} moneda
            hint="Lo que rebajaste del precio de lista" />
          <Numero i={3} icon={CalendarCheck} tone="slate" label="Reservas activas" valor={resumen.reservas_activas ?? 0}
            hint="Clientes que dejaron seña" />
        </div>

        {/* El día y la meta */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Entrada i={4} className="lg:col-span-2">
            <section className="h-full rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h2 className="text-base font-bold text-gris-900">Resumen del día</h2>
              </div>
              <p className="mt-1 text-[13px] text-gris-500">
                «Vendido» es el precio con tu descuento ya aplicado; «cobrado» es lo que el cliente pagó hoy, sin permutas ni señas de antes.
              </p>

              <div className="mt-3">
                <Fila label="Vendido hoy" valor={bsFmt(resumen.bruto_dia)} />
                <Fila label="Cobrado hoy" valor={bsFmt(resumen.cobrado_dia)} tono="emerald" />
                <Fila label="Descuentos que hiciste" valor={bsFmt(resumen.descuentos_dia)} tono="lila" />
                <Fila label="Cotizaciones de hoy" valor={resumen.cotizaciones_dia ?? 0} />
                <Fila label="Acumulado del mes" valor={bsFmt(resumen.total_mes)} />
              </div>

              {sinMovimiento && (
                <p className="mt-3 rounded-xl bg-gris-50 px-3 py-2.5 text-[13px] text-gris-600">
                  Todavía no registraste nada hoy. En cuanto cargues la primera venta o el primer servicio, estos números se mueven solos.
                </p>
              )}
            </section>
          </Entrada>

          <TarjetaMeta total={resumen.total_mes ?? 0} meta={meta} mes={resumen.mes ?? ''} />
        </div>

        {/* Accesos rápidos */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-gris-500">Lo que más usas</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AccesoRapido i={0} href={route('vendedor.ventas.create')} icon={PlusCircle} label="Registrar venta" hint="Con permuta, seña o descuento" />
            <AccesoRapido i={1} href={route('vendedor.servicios.create')} icon={Hammer} label="Nuevo servicio" hint="Deja la nota lista para imprimir" />
            <AccesoRapido i={2} href={route('vendedor.cotizaciones.create')} icon={Receipt} label="Cotizar" hint="Se envía por WhatsApp o correo" />
            <AccesoRapido i={3} href={route('vendedor.reservas.create')} icon={CalendarCheck} label="Tomar una reserva" hint="Guarda la seña del cliente" />
          </div>
        </section>

        {/* Lo último que registraste */}
        <div className="grid gap-5 lg:grid-cols-3">
          <ListaReciente
            i={0} icon={ShoppingCart} titulo="Tus últimas ventas" verTodo={route('vendedor.ventas.index')}
            items={ultimasVentas} vacio="Todavía no registraste ninguna venta."
            render={(v) => (
              <>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-gris-800">{v.cliente || 'Sin nombre'}</span>
                  <span className="block truncate font-mono text-[11px] text-gris-400">{v.codigo || '—'} · {fechaCorta(v.fecha)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-bold tabular-nums text-gris-900">{bsFmt(v.total)}</span>
              </>
            )}
          />

          <ListaReciente
            i={1} icon={Receipt} titulo="Tus últimas cotizaciones" verTodo={route('vendedor.cotizaciones.index')}
            items={ultimasCotizaciones} vacio="Todavía no hiciste ninguna cotización."
            render={(c) => (
              <>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-gris-800">{c.cliente || 'Sin nombre'}</span>
                  <span className="block text-[11px] text-gris-400">{fechaCorta(c.fecha)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-bold tabular-nums text-gris-900">{bsFmt(c.total)}</span>
              </>
            )}
          />

          <ListaReciente
            i={2} icon={Hammer} titulo="Tus últimos servicios" verTodo={route('vendedor.servicios.index')}
            items={ultimosServicios} vacio="Todavía no registraste ningún servicio."
            render={(s) => (
              <>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-gris-800">{s.equipo || 'Equipo'}</span>
                  <span className="block truncate text-[11px] text-gris-400">{s.cliente || 'Sin nombre'} · {fechaCorta(s.fecha)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-bold tabular-nums text-gris-900">{bsFmt(s.total)}</span>
              </>
            )}
          />
        </div>

        <Entrada i={3}>
          <section className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-base font-bold text-gris-900">Para que el día salga redondo</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {CONSEJOS_VENDEDOR.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl bg-gris-50 px-3.5 py-3 text-[13px] leading-relaxed text-gris-600 transition-colors hover:bg-[rgb(var(--acento-rgb)_/_0.06)]">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#121214] text-[11px] font-bold text-white">{i + 1}</span>
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
