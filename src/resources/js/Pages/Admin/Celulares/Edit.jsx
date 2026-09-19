import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { Smartphone } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import {
  EncabezadoFormulario, ErroresResumen, HistorialEquipo, ModalEliminar, Nota, ZonaPeligro, fmtFecha,
} from '@/Components/Admin/inventario';
import {
  CamposCelular, ResumenCelular, datosDesde, detalleEquipo, nombreEquipo, payloadDe, useFormularioCelular, validarCelular,
} from '@/Components/Admin/celulares';

export default function Edit({ celular, historial = [], bloqueo = null, sugerencias = {} }) {
  const original = datosDesde(celular);
  const form = useFormularioCelular(original);
  const { data, errores, setErrores } = form;
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });
  const hayCambios = Object.keys(original).some((k) => data[k] !== original[k]);
  const ventas = historial.filter((m) => m.tipo === 'venta');
  const nombre = nombreEquipo(celular);
  const detalle = detalleEquipo(celular);

  const avisoEstado = ventas.length > 0 && data.estado !== 'vendido' ? (
    <Nota tono="amber">Figura en la venta {ventas[0].codigo}. Cambiar el estado aquí no modifica esa venta.</Nota>
  ) : null;

  const guardar = () => {
    if (guardando || !hayCambios) return;
    const e = validarCelular(data, original);
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por corregir.');
      return;
    }
    router.put(route('admin.celulares.update', celular.id), payloadDe(data), {
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
    router.delete(route('admin.celulares.destroy', celular.id), {
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
      <Head title={`Editar celular · ${nombre}`} />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.celulares.index')} volverLabel="Volver a celulares" titulo="Editar celular"
          subtitulo={[nombre, detalle, `Registrado el ${fmtFecha(celular.created_at, true)}`].filter(Boolean).join(' · ')} />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposCelular form={form} sugerencias={sugerencias} avisoEstado={avisoEstado} />
            <HistorialEquipo historial={historial} />
            <ZonaPeligro
              bloqueo={bloqueo}
              sustantivo="celular"
              onEliminar={() => setBorrar(true)}
            />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenCelular data={data}>
              <ErroresResumen errores={errores} />
              {hayCambios && <p className="text-center text-xs font-semibold text-amber-700">Tienes cambios sin guardar.</p>}
              <button type="button" onClick={guardar} disabled={guardando || !hayCambios} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <Link href={route('admin.celulares.index')} className={buttonCls('secondary', 'h-11 w-full')}>Cancelar</Link>
              <p className="text-center text-xs text-gris-400">Última actualización: {fmtFecha(celular.updated_at, true)}</p>
            </ResumenCelular>
          </aside>
        </div>
      </div>

      {borrar && (
        <ModalEliminar titulo="Eliminar celular" icon={Smartphone} nombre={nombre}
          detalle={[detalle, `IMEI ${celular.imei_1}`].filter(Boolean).join(' · ')}
          procesando={eliminando} onConfirmar={eliminar} onCerrar={() => setBorrar(false)} />
      )}
    </AdminLayout>
  );
}
