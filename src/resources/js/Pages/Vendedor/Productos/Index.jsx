import VendedorLayout from '@/Layouts/VendedorLayout';
import { Head, Link, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useState } from 'react';
import { Boxes, PlusCircle, Search, Tag, X } from 'lucide-react';
import { EmptyState, PageHeader, Paginador, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';
import { Stat } from '@/Components/Admin/inventario';
import AdminGuide from '@/Components/Admin/AdminGuide';
import { TablaStock } from '@/Components/Vendedor/stock';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';

// Productos en stock: solo lo que está disponible para vender, con el precio de venta.
// El costo y la procedencia no llegan desde el servidor: son datos del administrador.

export default function Index({ tipo, pestanas = [], productos, filtros = {}, resumen = {} }) {
  const [q, setQ] = useState(filtros.q ?? '');
  const [cargando, setCargando] = useState(false);
  // Otro vendedor puede vender un equipo mientras esta pantalla está abierta
  useAutoRefresh(['productos', 'pestanas', 'resumen']);

  useEffect(() => { setQ(filtros.q ?? ''); }, [filtros.q]);

  const ir = (extra = {}) => {
    setCargando(true);
    router.get(route('vendedor.productos.index'), { tipo, q, ...extra }, {
      preserveState: true, preserveScroll: true, replace: true,
      onFinish: () => setCargando(false),
    });
  };

  const cambiarPestana = (clave) => {
    setCargando(true);
    router.get(route('vendedor.productos.index'), { tipo: clave }, {
      preserveScroll: true, replace: true, onFinish: () => setCargando(false),
    });
  };

  const items = productos?.data ?? [];
  const pestanaActiva = pestanas.find((p) => p.clave === tipo);
  const stockTotal = pestanas.reduce((a, p) => a + p.total, 0);

  return (
    <VendedorLayout title="Productos en stock">
      <Head title="Productos en stock" />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Productos en stock"
          subtitle="Lo que hay disponible hoy para vender, con su precio. Si no está acá, ya se vendió o está reservado."
          actions={(
            <Link href={route('vendedor.ventas.create')} className={buttonCls('primary', 'h-11')}>
              <PlusCircle className="h-4 w-4" /> Registrar venta
            </Link>
          )}
        />

        <AdminGuide
          id="vendedor-stock"
          title="¿Cómo usar el stock?"
          steps={[
            'Elige la pestaña del tipo de producto: el número dice cuántos quedan disponibles.',
            'Busca por modelo, color, IMEI, serie o código; la búsqueda recorre todo el inventario, no solo esta página.',
            'El precio que ves es el de venta al cliente. Si necesitas hacer un descuento, se aplica al registrar la venta.',
          ]}
          tip="Cuando registras una venta, el equipo desaparece de esta lista automáticamente."
        >
          Solo aparece lo disponible
        </AdminGuide>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={Boxes} tone="navy" label={`Disponibles en ${pestanaActiva?.label ?? 'esta pestaña'}`} value={pestanaActiva?.total ?? 0}
            hint={`${stockTotal} en todo el inventario`} />
          <Stat icon={Search} tone="lila" label="Con lo que buscaste" value={resumen.encontrados ?? 0}
            hint={filtros.q ? `Buscando «${filtros.q}»` : 'Sin filtro de búsqueda'} />
          <Stat icon={Tag} tone="emerald" label="Valor de lo listado" value={bsFmt(resumen.valor)}
            hint="Sumando los precios de venta" />
        </div>

        <section className="overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil">
          <div className="border-b border-gris-100 p-4">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Tipo de producto">
              {pestanas.map((p) => {
                const activa = p.clave === tipo;
                return (
                  <button
                    key={p.clave}
                    type="button"
                    role="tab"
                    aria-selected={activa}
                    onClick={() => !activa && cambiarPestana(p.clave)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                      activa ? 'bg-carbon-900 text-white' : 'border border-gris-200 bg-white text-gris-600 hover:border-gris-300 hover:text-gris-900'
                    }`}
                  >
                    {p.label}
                    <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${activa ? 'bg-white/20' : 'bg-gris-100 text-gris-500'}`}>
                      {p.total}
                    </span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); ir({ page: 1 }); }} className="mt-3 flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Modelo, color, IMEI, serie o código"
                  aria-label="Buscar en el stock"
                  className={`${inputCls} h-10 pl-9 ${filtros.q ? 'pr-9' : ''}`}
                />
                {filtros.q && (
                  <button type="button" onClick={() => { setQ(''); ir({ q: '', page: 1 }); }} aria-label="Limpiar la búsqueda"
                    className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-gris-400 hover:bg-gris-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button type="submit" className={buttonCls('secondary', 'h-10')}>Buscar</button>
            </form>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={filtros.q ? 'Nada coincide con esa búsqueda' : `No queda ningún ${pestanaActiva?.label?.toLowerCase() ?? 'producto'} disponible`}
              text={filtros.q
                ? 'Probá con parte del modelo, con el IMEI completo o con el código del producto.'
                : 'Cuando el administrador cargue equipos nuevos, van a aparecer acá solos.'}
              action={filtros.q
                ? <button type="button" onClick={() => { setQ(''); ir({ q: '', page: 1 }); }} className={buttonCls('secondary')}>Ver todo el stock</button>
                : null}
            />
          ) : (
            <>
              <TablaStock items={items} tipo={tipo} />
              <Paginador meta={productos} cargando={cargando} onPagina={(p) => ir({ page: p })} />
            </>
          )}
        </section>
      </div>
    </VendedorLayout>
  );
}
