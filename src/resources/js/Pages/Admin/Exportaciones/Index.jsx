import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { route } from 'ziggy-js';
import {
  Apple, Boxes, FileDown, FolderTree, Laptop, MapPin, Search, Smartphone, Tags, TriangleAlert,
} from 'lucide-react';
import AdminGuide from '@/Components/Admin/AdminGuide';
import { PageHeader, Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import { Aviso, Stat } from '@/Components/Admin/inventario';

// Exportar datos → Exportaciones: un PDF por inventario y por tipo de producto general, con el precio de costo, el
// de venta y la ganancia esperada. Es un documento interno: nunca se comparte con el cliente.

const ICONOS = {
  celulares: Smartphone,
  computadoras: Laptop,
  productos_generales: Boxes,
  productos_apple: Apple,
};

const RUTAS = {
  celulares: 'admin.exportar.celulares',
  computadoras: 'admin.exportar.computadoras',
  productos_generales: 'admin.exportar.productos-generales',
  productos_apple: 'admin.exportar.productos-apple',
};

function TarjetaExportar({ icon: Icon, titulo, detalle, href, vacia = false, nuevaPestana = true }) {
  const contenido = (
    <>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${vacia ? 'bg-gris-100 text-gris-400' : 'bg-[#121214]/[0.07] text-[#121214]'}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-gris-900">{titulo}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gris-500">{detalle}</p>
        </div>
      </div>
      <span className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold ${vacia ? 'text-gris-400' : 'text-[#96684F]'}`}>
        <FileDown className="h-3.5 w-3.5" /> {vacia ? 'Nada para exportar' : 'Abrir el PDF'}
      </span>
    </>
  );

  const clase = `block rounded-2xl border p-4 text-left transition-shadow ${vacia
    ? 'cursor-not-allowed border-gris-200/80 bg-gris-50/60'
    : 'border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]'}`;

  if (vacia) return <div className={clase} aria-disabled="true">{contenido}</div>;

  return nuevaPestana
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={clase}>{contenido}</a>
    : <Link href={href} className={clase}>{contenido}</Link>;
}

export default function ExportacionesIndex({ subtipos = [], inventarios = [], tienda = {} }) {
  const [toast] = useToast();

  const totalDisponible = inventarios.reduce((n, i) => n + i.disponibles, 0);
  const conStock = subtipos.filter((s) => s.disponibles > 0);
  const sinDatosDeContacto = !tienda.direccion || !tienda.telefono;

  return (
    <AdminLayout>
      <Head title="Exportaciones" />
      <Toast toast={toast} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Exportaciones"
          subtitle="El inventario en PDF, listo para imprimir o mandar por WhatsApp a tu equipo. Cada listado trae el costo, el precio de venta y la ganancia esperada."
          actions={(
            <Link href={route('admin.exportar.personalizado')} className={buttonCls('primary', 'h-11 px-4')}>
              <Search className="h-4 w-4" /> Buscar y exportar
            </Link>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {inventarios.map((inv) => {
            const Icon = ICONOS[inv.value] ?? Boxes;
            return (
              <Stat key={inv.value} icon={Icon} label={inv.label} value={inv.disponibles.toLocaleString('es-BO')}
                tone={inv.disponibles > 0 ? 'navy' : 'slate'}
                hint={`disponibles de ${inv.total.toLocaleString('es-BO')}`} />
            );
          })}
        </div>

        <AdminGuide id="exportaciones" title="¿Para qué sirven estos PDF?" steps={[
          'Elige el inventario o el tipo de producto que necesitas: el PDF se abre en otra pestaña, listo para imprimir o guardar.',
          'Cada listado trae lo disponible hoy, con el costo, el precio de venta y la ganancia esperada al final.',
          'Si buscas algo puntual («fundas MagSafe de 14 Pro Max»), usa «Buscar y exportar»: filtra por nombre y arma el PDF solo con eso.',
        ]} tip="Estos PDF son para adentro: muestran el costo y la ganancia. Para pasarle precios a un cliente, usa una cotización." />

        {sinDatosDeContacto && (
          <Aviso tono="amber" icon={MapPin} accion="Ir a Datos del negocio"
            onAccion={() => window.location.assign(route('admin.configuracion.negocio.edit'))}>
            <span className="font-bold">Al pie de los PDF le faltan tus datos.</span>{' '}
            {!tienda.direccion && !tienda.telefono
              ? 'No hay dirección ni teléfono cargados en Ajustes → Datos del negocio.'
              : !tienda.direccion ? 'Falta la dirección en Ajustes → Datos del negocio.' : 'Falta el teléfono en Ajustes → Datos del negocio.'}
          </Aviso>
        )}

        {totalDisponible === 0 && (
          <Aviso tono="lila" icon={TriangleAlert}>
            <span className="font-bold">No hay nada disponible en el inventario.</span>{' '}
            Los PDF saldrían vacíos hasta que registres productos.
          </Aviso>
        )}

        <section className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
            <Boxes className="h-[18px] w-[18px] text-[#96684F]" /> Por inventario
          </h2>
          <p className="mt-0.5 text-[13px] text-gris-500">Todo lo que está disponible hoy, en un solo listado.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inventarios.map((inv) => (
              <TarjetaExportar
                key={inv.value}
                icon={ICONOS[inv.value] ?? Boxes}
                titulo={inv.label}
                detalle={inv.disponibles > 0
                  ? `${inv.disponibles.toLocaleString('es-BO')} ${inv.disponibles === 1 ? 'disponible' : 'disponibles'}`
                  : 'Ninguno disponible'}
                href={route(RUTAS[inv.value])}
                vacia={inv.disponibles === 0}
              />
            ))}

            <TarjetaExportar
              icon={Search}
              titulo="Buscar y exportar"
              detalle="Filtra por nombre o modelo y arma el PDF solo con eso."
              href={route('admin.exportar.personalizado')}
              nuevaPestana={false}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
            <Tags className="h-[18px] w-[18px] text-[#96684F]" /> Por tipo de producto general
            <span className="text-sm font-semibold text-gris-400">{subtipos.length}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-gris-500">
            Los tipos salen solos del inventario: cargadores, vidrios, fundas y lo que vayas registrando.
          </p>

          {subtipos.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gris-200 px-4 py-6 text-center text-[13px] text-gris-500">
              Todavía no hay productos generales con un tipo cargado.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {subtipos.map((s) => (
                <TarjetaExportar
                  key={s.tipo}
                  icon={FolderTree}
                  titulo={s.label}
                  detalle={s.disponibles > 0
                    ? `${s.disponibles.toLocaleString('es-BO')} ${s.disponibles === 1 ? 'disponible' : 'disponibles'} de ${s.total.toLocaleString('es-BO')}`
                    : `Ninguno disponible (${s.total.toLocaleString('es-BO')} vendidos)`}
                  href={route('admin.exportar.productos-generales.tipo', s.tipo)}
                  vacia={s.disponibles === 0}
                />
              ))}
            </div>
          )}

          {conStock.length < subtipos.length && (
            <p className="mt-3 rounded-xl bg-gris-50 px-3.5 py-3 text-xs leading-relaxed text-gris-600">
              Los tipos en gris no tienen nada disponible: su PDF saldría vacío, así que quedan apagados.
            </p>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
