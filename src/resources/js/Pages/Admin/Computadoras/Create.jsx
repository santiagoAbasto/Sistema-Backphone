import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { route } from 'ziggy-js';
import { CopyPlus } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import { EncabezadoFormulario, ErroresResumen, useFormularioInventario } from '@/Components/Admin/inventario';
import {
  ALIAS_ERRORES, CamposComputadora, ResumenComputadora, datosDesde, payloadDe, validarComputadora,
} from '@/Components/Admin/computadoras';

export default function Create({ sugerencias = {} }) {
  const form = useFormularioInventario(datosDesde(null), ALIAS_ERRORES);
  const { data, setData, errores, setErrores } = form;
  const [guardando, setGuardando] = useState(null);
  const [registradas, setRegistradas] = useState(0);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();
  const refs = { nombre: useRef(null), serie: useRef(null) };

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  // «Registrar otra» vuelve a esta página con el mismo modelo, chip, memoria, color, precios y procedencia
  const guardar = (otra = false) => {
    if (guardando) return;
    const e = validarComputadora(data);
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    router.post(route('admin.computadoras.store'), {
      ...payloadDe(data),
      ...(otra ? { return_to: route('admin.computadoras.create', undefined, false) } : {}),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(otra ? 'otra' : 'listado'),
      onSuccess: () => {
        notifyRecordsUpdated();
        if (!otra) return;
        setRegistradas((n) => n + 1);
        setData((d) => ({ ...d, numero_serie: '', bateria_pct: '', ciclos: '' }));
        setErrores({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => refs.serie.current?.focus(), 300);
      },
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo registrar la computadora', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(null),
    });
  };

  return (
    <AdminLayout>
      <Head title="Registrar computadora" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.computadoras.index')} volverLabel="Volver a computadoras"
          titulo="Registrar computadora" subtitulo="Carga un equipo al inventario para poder venderlo y cotizarlo." />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposComputadora form={form} sugerencias={sugerencias} pasos refs={refs} />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenComputadora data={data}>
              <ErroresResumen errores={errores} />
              <button type="button" onClick={() => guardar(false)} disabled={Boolean(guardando)} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando === 'listado' ? 'Guardando…' : 'Guardar computadora'}
              </button>
              <button type="button" onClick={() => guardar(true)} disabled={Boolean(guardando)} className={buttonCls('secondary', 'h-11 w-full')}>
                <CopyPlus className="h-4 w-4" /> {guardando === 'otra' ? 'Guardando…' : 'Guardar y registrar otra'}
              </button>
              <p className="text-center text-xs leading-relaxed text-gris-400">
                «Registrar otra» mantiene el modelo, el chip, la memoria, el color, los precios y la procedencia; solo cambias la serie y la batería.
                {registradas > 0 && <span className="mt-1 block font-semibold text-emerald-700">Llevas {registradas} {registradas === 1 ? 'computadora registrada' : 'computadoras registradas'} seguidas.</span>}
              </p>
            </ResumenComputadora>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
