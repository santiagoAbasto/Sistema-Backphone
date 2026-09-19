import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { route } from 'ziggy-js';
import { CopyPlus } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import { EncabezadoFormulario, ErroresResumen } from '@/Components/Admin/inventario';
import {
  CamposCelular, ResumenCelular, datosDesde, payloadDe, useFormularioCelular, validarCelular,
} from '@/Components/Admin/celulares';

export default function Create({ sugerencias = {} }) {
  const form = useFormularioCelular(datosDesde(null));
  const { data, setData, errores, setErrores } = form;
  const [guardando, setGuardando] = useState(null);
  const [registrados, setRegistrados] = useState(0);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();
  const refs = { modelo: useRef(null), color: useRef(null), imei: useRef(null) };

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  // «Registrar otro» vuelve a esta página con el mismo modelo, capacidad, precios y procedencia
  const guardar = (otro = false) => {
    if (guardando) return;
    const e = validarCelular(data);
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    router.post(route('admin.celulares.store'), {
      ...payloadDe(data),
      ...(otro ? { return_to: route('admin.celulares.create', undefined, false) } : {}),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(otro ? 'otro' : 'listado'),
      onSuccess: () => {
        notifyRecordsUpdated();
        if (!otro) return;
        setRegistrados((n) => n + 1);
        setData((d) => ({ ...d, color: '', bateria_pct: '', imei_1: '', imei_2: '', numero_serie: '' }));
        setErrores({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => refs.color.current?.focus(), 300);
      },
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo registrar el celular', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(null),
    });
  };

  return (
    <AdminLayout>
      <Head title="Registrar celular" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.celulares.index')} volverLabel="Volver a celulares"
          titulo="Registrar celular" subtitulo="Carga un equipo al inventario para poder venderlo y cotizarlo." />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposCelular form={form} sugerencias={sugerencias} pasos refs={refs} />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenCelular data={data}>
              <ErroresResumen errores={errores} />
              <button type="button" onClick={() => guardar(false)} disabled={Boolean(guardando)} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando === 'listado' ? 'Guardando…' : 'Guardar celular'}
              </button>
              <button type="button" onClick={() => guardar(true)} disabled={Boolean(guardando)} className={buttonCls('secondary', 'h-11 w-full')}>
                <CopyPlus className="h-4 w-4" /> {guardando === 'otro' ? 'Guardando…' : 'Guardar y registrar otro'}
              </button>
              <p className="text-center text-xs leading-relaxed text-gris-400">
                «Registrar otro» mantiene el modelo, la capacidad, los precios y la procedencia para cargar el siguiente equipo.
                {registrados > 0 && <span className="mt-1 block font-semibold text-emerald-700">Llevas {registrados} {registrados === 1 ? 'celular registrado' : 'celulares registrados'} seguidos.</span>}
              </p>
            </ResumenCelular>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
