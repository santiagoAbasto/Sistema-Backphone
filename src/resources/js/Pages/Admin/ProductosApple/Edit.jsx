import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { Apple } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import {
  EncabezadoFormulario, ErroresResumen, HistorialEquipo, ModalEliminar, Nota, ZonaPeligro, fmtFecha,
} from '@/Components/Admin/inventario';
import {
  CamposProductoApple, ResumenProductoApple, datosDesde, detalleEquipo, nombreEquipo, payloadDe, useFormularioProductoApple, validarProductoApple,
} from '@/Components/Admin/productos-apple';

export default function Edit({ productoApple, historial = [], bloqueo = null, sugerencias = {} }) {
  const original = datosDesde(productoApple);
  const form = useFormularioProductoApple(original);
  const { data, errores, setErrores } = form;
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });
  const hayCambios = Object.keys(original).some((k) => data[k] !== original[k]);
  const ventas = historial.filter((m) => m.tipo === 'venta');
  const nombre = nombreEquipo(productoApple);
  const detalle = detalleEquipo(productoApple);

  const avisoEstado = ventas.length > 0 && data.estado !== 'vendido' ? (
    <Nota tono="amber">Figura en la venta {ventas[0].codigo}. Cambiar el estado aquí no modifica esa venta.</Nota>
  ) : null;

  const guardar = () => {
    if (guardando || !hayCambios) return;
    const e = validarProductoApple(data);
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por corregir.');
      return;
    }
    router.put(route('admin.productos-apple.update', productoApple.id), payloadDe(data), {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(true),
      onSuccess: () => notifyRecordsUpdated(),
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo guardar', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(false),
    });
  };

  const eliminar = () => {
    if (eliminando) return;
    router.delete(route('admin.productos-apple.destroy', productoApple.id), {
      onStart: () => setEliminando(true),
      onSuccess: () => {
        setBorrar(false);
        notifyRecordsUpdated();
      },
      onFinish: () => setEliminando(false),
    });
  };

  return (
    <AdminLayout>
      <Head title={`Editar producto Apple · ${nombre}`} />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.productos-apple.index')} volverLabel="Volver a equipos de marca" titulo="Editar equipo de marca"
          subtitulo={[nombre, detalle, `Registrado el ${fmtFecha(productoApple.created_at, true)}`].filter(Boolean).join(' · ')} />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposProductoApple form={form} sugerencias={sugerencias} avisoEstado={avisoEstado} />
            <HistorialEquipo historial={historial} />
            <ZonaPeligro
              bloqueo={bloqueo}
              sustantivo="producto"
              onEliminar={() => setBorrar(true)}
            />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenProductoApple data={data}>
              <ErroresResumen errores={errores} />
              {hayCambios && <p className="text-center text-xs font-semibold text-amber-700">Tienes cambios sin guardar.</p>}
              <button type="button" onClick={guardar} disabled={guardando || !hayCambios} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <Link href={route('admin.productos-apple.index')} className={buttonCls('secondary', 'h-11 w-full')}>Cancelar</Link>
              <p className="text-center text-xs text-gris-400">Última actualización: {fmtFecha(productoApple.updated_at, true)}</p>
            </ResumenProductoApple>
          </aside>
        </div>
      </div>

      {borrar && (
        <ModalEliminar titulo="Eliminar producto Apple" icon={Apple} nombre={nombre}
          detalle={[detalle, productoApple.numero_serie && `Serie ${productoApple.numero_serie}`].filter(Boolean).join(' · ')}
          procesando={eliminando} onConfirmar={eliminar} onCerrar={() => setBorrar(false)} />
      )}
    </AdminLayout>
  );
}
