import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { Building2, FileText, Plus, Printer } from 'lucide-react';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';
import { Badge, EmptyState, PageHeader, Paginador, Select, Toast, bsFmt, buttonCls, useToast } from '@/Components/Admin/ui';

// Ventas a otras tiendas, a precio mayorista. Son ventas normales: descuentan del inventario,
// llevan nota y entran a la caja. Acá solo se ven aparte de las de cliente final.

const PAGO = {
  efectivo: 'Efectivo', qr: 'QR', transferencia: 'Transferencia', tarjeta: 'Tarjeta',
};

const fecha = (iso) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
const hora = (iso) => new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

function AccionNota({ href, icon: Icon, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-[8px] border border-gris-200 bg-white text-gris-500 transition-colors hover:border-gris-300 hover:bg-gris-50 hover:text-gris-900">
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}

const Notas = ({ venta }) => (
  <div className="flex items-center gap-1.5">
    <AccionNota href={route('admin.ventas-tiendas.boleta', venta.id)} icon={FileText} label={`Nota ${venta.codigo_nota}`} />
    <AccionNota href={route('admin.ventas-tiendas.boleta80', venta.id)} icon={Printer} label={`Nota ${venta.codigo_nota} en ticket de 80 mm`} />
  </div>
);

const Contacto = ({ venta }) => {
  const texto = [venta.responsable, venta.telefono].filter(Boolean).join(' · ');
  return texto ? <p className="truncate text-xs text-gris-500">{texto}</p> : null;
};

export default function Index({ ventas, tiendas = [], filtros = {} }) {
  useAutoRefresh(['ventas', 'tiendas']);
  const [toast] = useToast();
  const [cargando, setCargando] = useState(false);
  const filas = ventas?.data ?? [];

  const ir = (extra = {}) => {
    setCargando(true);
    router.get(route('admin.ventas-tiendas.index'), { tienda: filtros.tienda ?? undefined, ...extra }, {
      preserveState: true, preserveScroll: true, replace: true, onFinish: () => setCargando(false),
    });
  };

  return (
    <AdminLayout title="Ventas a tiendas">
      <Head title="Ventas a tiendas" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Ventas a tiendas"
          subtitle="Lo que se vende a otras tiendas, a precio mayorista. Cada venta descuenta del inventario, lleva su nota y entra a la caja como cualquier otra."
          actions={(
            <Link href={route('admin.ventas-tiendas.create')} className={buttonCls('primary', 'h-11 px-5')}>
              <Plus className="h-4 w-4" /> Nueva venta a tienda
            </Link>
          )}
        />

        {tiendas.length > 0 && (
          <div className="max-w-xs">
            <Select aria-label="Filtrar por tienda" value={filtros.tienda ?? ''}
              onChange={(e) => ir({ tienda: e.target.value || undefined, page: 1 })}>
              <option value="">Todas las tiendas</option>
              {tiendas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Select>
          </div>
        )}

        <section className="overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil">
          {filas.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={filtros.tienda ? 'Esta tienda todavía no te compró' : 'Todavía no hay ventas a tiendas'}
              text="Cuando vendas a otra tienda, la venta aparece acá con su nota. Solo se ofrecen los productos que tienen precio para tiendas en el inventario."
              action={(
                <Link href={route('admin.ventas-tiendas.create')} className={buttonCls('primary')}>
                  <Plus className="h-4 w-4" /> Nueva venta a tienda
                </Link>
              )}
            />
          ) : (
            <>
              {/* Pantallas anchas */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gris-100 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-500">
                      <th className="px-5 py-3">Nota</th>
                      <th className="px-3 py-3">Tienda</th>
                      <th className="px-3 py-3 text-right">Productos</th>
                      <th className="px-3 py-3">Pago</th>
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3 text-right">Total</th>
                      <th className="px-5 py-3"><span className="sr-only">Notas</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {filas.map((v) => (
                      <tr key={v.id} className="hover:bg-gris-50/60">
                        <td className="px-5 py-3.5 font-semibold tabular-nums text-gris-900">{v.codigo_nota}</td>
                        <td className="max-w-[320px] px-3 py-3.5">
                          <p className="truncate font-semibold text-gris-900">{v.tienda}</p>
                          <Contacto venta={v} />
                        </td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-gris-700">{v.items}</td>
                        <td className="px-3 py-3.5"><Badge tone="slate">{PAGO[v.metodo_pago] ?? v.metodo_pago}</Badge></td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-gris-600">
                          {fecha(v.fecha)} <span className="text-gris-400">{hora(v.fecha)}</span>
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold tabular-nums text-gris-900">{bsFmt(v.total)}</td>
                        <td className="px-5 py-3.5"><div className="flex justify-end"><Notas venta={v} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Celular y tableta */}
              <ul className="divide-y divide-gris-100 lg:hidden">
                {filas.map((v) => (
                  <li key={v.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tabular-nums text-gris-500">{v.codigo_nota} · {fecha(v.fecha)}</p>
                        <p className="mt-0.5 truncate text-[15px] font-bold text-gris-900">{v.tienda}</p>
                        <Contacto venta={v} />
                      </div>
                      <p className="shrink-0 font-bold tabular-nums text-gris-900">{bsFmt(v.total)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="slate">{PAGO[v.metodo_pago] ?? v.metodo_pago}</Badge>
                        <span className="text-xs text-gris-500">{v.items} {v.items === 1 ? 'producto' : 'productos'}</span>
                      </div>
                      <Notas venta={v} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Paginador meta={ventas} cargando={cargando} onPagina={(n) => ir({ page: n })} />
        </section>
      </div>
    </AdminLayout>
  );
}
