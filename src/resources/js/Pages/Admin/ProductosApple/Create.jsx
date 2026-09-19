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
  CamposProductoApple, ResumenProductoApple, datosDesde, payloadDe, useFormularioProductoApple, validarProductoApple,
} from '@/Components/Admin/productos-apple';

export default function Create({ sugerencias = {} }) {
  const form = useFormularioProductoApple(datosDesde(null));
  const { data, setData, errores, setErrores } = form;
  const [guardando, setGuardando] = useState(null);
  const [registrados, setRegistrados] = useState(0);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();
  const refs = { modelo: useRef(null), color: useRef(null), serie: useRef(null), imei: useRef(null) };

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  // «Registrar otro» vuelve a esta página con el mismo modelo, capacidad, color, precios y procedencia
  const guardar = (otro = false) => {
    if (guardando) return;
    const e = validarProductoApple(data);
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    router.post(route('admin.productos-apple.store'), {
      ...payloadDe(data),
      ...(otro ? { return_to: route('admin.productos-apple.create', undefined, false) } : {}),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(otro ? 'otro' : 'listado'),
      onSuccess: () => {
        notifyRecordsUpdated();
        if (!otro) return;
        setRegistrados((n) => n + 1);
        setData((d) => ({ ...d, numero_serie: '', imei_1: '', imei_2: '' }));
        setErrores({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => refs.serie.current?.focus(), 300);
      },
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo registrar el producto', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(null),
    });
  };

  return (
    <AdminLayout>
      <Head title="Registrar producto Apple" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.productos-apple.index')} volverLabel="Volver a equipos de marca"
          titulo="Registrar producto Apple" subtitulo="iPad, AirPods, Apple Watch, Pencil o accesorios: cárgalo para poder venderlo y cotizarlo." />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposProductoApple form={form} sugerencias={sugerencias} pasos refs={refs} />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenProductoApple data={data}>
              <ErroresResumen errores={errores} />
              <button type="button" onClick={() => guardar(false)} disabled={Boolean(guardando)} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando === 'listado' ? 'Guardando…' : 'Guardar producto'}
              </button>
              <button type="button" onClick={() => guardar(true)} disabled={Boolean(guardando)} className={buttonCls('secondary', 'h-11 w-full')}>
                <CopyPlus className="h-4 w-4" /> {guardando === 'otro' ? 'Guardando…' : 'Guardar y registrar otro'}
              </button>
              <p className="text-center text-xs leading-relaxed text-gris-400">
                «Registrar otro» mantiene el modelo, la capacidad, el color, los precios y la procedencia; solo cambias la serie.
                {registrados > 0 && <span className="mt-1 block font-semibold text-emerald-700">Llevas {registrados} {registrados === 1 ? 'producto registrado' : 'productos registrados'} seguidos.</span>}
              </p>
            </ResumenProductoApple>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
