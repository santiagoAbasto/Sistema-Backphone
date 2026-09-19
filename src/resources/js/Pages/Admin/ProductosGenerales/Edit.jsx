import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { Package } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import {
  EncabezadoFormulario, ErroresResumen, HistorialEquipo, ModalEliminar, Nota, ZonaPeligro, fmtFecha,
} from '@/Components/Admin/inventario';
import {
  CamposProductoGeneral, ResumenProductoGeneral, datosDesde, nombreProducto, payloadDe, tipoTexto, useCodigoDisponible,
  useFormularioProductoGeneral, validarProductoGeneral,
} from '@/Components/Admin/productos-generales';

export default function Edit({ producto, historial = [], bloqueo = null, sugerencias = {} }) {
  const original = datosDesde(producto);
  const form = useFormularioProductoGeneral(original);
  const { data, errores, setErrores } = form;
  const estadoCodigo = useCodigoDisponible(data.codigo, producto.codigo);
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });
  const hayCambios = Object.keys(original).some((k) => data[k] !== original[k]);
  const ventas = historial.filter((m) => m.tipo === 'venta');
  const nombre = nombreProducto(producto);
  const detalle = [tipoTexto(producto.tipo), producto.codigo].filter(Boolean).join(' · ');

  const avisoEstado = ventas.length > 0 && data.estado !== 'vendido' ? (
    <Nota tono="amber">Figura en la venta {ventas[0].codigo}. Cambiar el estado aquí no modifica esa venta.</Nota>
  ) : null;

  const guardar = () => {
    if (guardando || !hayCambios) return;
    const e = validarProductoGeneral(data);
    if (!e.codigo && estadoCodigo === 'ocupado') e.codigo = 'Ya hay un producto con este código.';
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por corregir.');
      return;
    }
    router.put(route('admin.productos-generales.update', producto.id), payloadDe(data), {
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
    router.delete(route('admin.productos-generales.destroy', producto.id), {
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
      <Head title={`Editar producto · ${nombre}`} />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.productos-generales.index')} volverLabel="Volver a productos generales" titulo="Editar producto general"
          subtitulo={[nombre, detalle, `Registrado el ${fmtFecha(producto.created_at, true)}`].filter(Boolean).join(' · ')} />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposProductoGeneral form={form} sugerencias={sugerencias} estadoCodigo={estadoCodigo} avisoEstado={avisoEstado} />
            <HistorialEquipo historial={historial} />
            <ZonaPeligro
              bloqueo={bloqueo}
              sustantivo="producto"
              onEliminar={() => setBorrar(true)}
            />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenProductoGeneral data={data}>
              <ErroresResumen errores={errores} />
              {hayCambios && <p className="text-center text-xs font-semibold text-amber-700">Tienes cambios sin guardar.</p>}
              <button type="button" onClick={guardar} disabled={guardando || !hayCambios} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <Link href={route('admin.productos-generales.index')} className={buttonCls('secondary', 'h-11 w-full')}>Cancelar</Link>
              <p className="text-center text-xs text-gris-400">Última actualización: {fmtFecha(producto.updated_at, true)}</p>
            </ResumenProductoGeneral>
          </aside>
        </div>
      </div>

      {borrar && (
        <ModalEliminar titulo="Eliminar producto general" icon={Package} nombre={nombre} detalle={detalle}
          procesando={eliminando} onConfirmar={eliminar} onCerrar={() => setBorrar(false)} />
      )}
    </AdminLayout>
  );
}
