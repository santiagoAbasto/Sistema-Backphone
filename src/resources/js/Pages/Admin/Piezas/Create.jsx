import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { CopyPlus } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import { EncabezadoFormulario, ErroresResumen } from '@/Components/Admin/inventario';
import { CamposPieza, ResumenPieza, datosDesde, payloadDe, useFormularioPieza, validarPieza } from '@/Components/Admin/piezas';

export default function Create({ categorias = [], sugerencias = [] }) {
  const form = useFormularioPieza(datosDesde(null));
  const { data, setData, errores, setErrores } = form;
  const [guardando, setGuardando] = useState(null);
  const [registradas, setRegistradas] = useState(0);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  // «Registrar otra» deja la categoría y la compatibilidad puestas: de un mismo despiece salen
  // ocho repuestos seguidos y lo único que cambia es el nombre.
  const guardar = (otra = false) => {
    if (guardando) return;
    const e = validarPieza(data);
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    router.post(route('admin.piezas.store'), payloadDe(data), {
      preserveState: otra,
      preserveScroll: true,
      onStart: () => setGuardando(otra ? 'otra' : 'listado'),
      onSuccess: () => {
        notifyRecordsUpdated();
        if (!otra) return;
        setRegistradas((n) => n + 1);
        setData((d) => ({ ...d, nombre: '', codigo: '', cantidad: '', precio_costo: '', precio_venta: '', notas: '' }));
        setErrores({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo registrar la pieza', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(null),
    });
  };

  return (
    <AdminLayout title="Registrar pieza">
      <Head title="Registrar pieza" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.piezas.index')} volverLabel="Volver a piezas y repuestos"
          titulo="Registrar pieza" subtitulo="Lo imprescindible es el nombre, cuántas hay y a cuánto entra y sale." />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposPieza form={form} categorias={categorias} sugerencias={sugerencias} />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenPieza data={data}>
              <ErroresResumen errores={errores} />
              <button type="button" onClick={() => guardar(false)} disabled={Boolean(guardando)} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando === 'listado' ? 'Guardando…' : 'Guardar pieza'}
              </button>
              <button type="button" onClick={() => guardar(true)} disabled={Boolean(guardando)} className={buttonCls('secondary', 'h-11 w-full')}>
                <CopyPlus className="h-4 w-4" /> {guardando === 'otra' ? 'Guardando…' : 'Guardar y registrar otra'}
              </button>
              <p className="text-center text-xs leading-relaxed text-gris-400">
                «Registrar otra» mantiene la categoría, la compatibilidad y de dónde salió: de un mismo despiece salen varias piezas seguidas.
                {registradas > 0 && <span className="mt-1 block font-semibold text-emerald-700">Llevas {registradas} {registradas === 1 ? 'pieza registrada' : 'piezas registradas'} seguidas.</span>}
              </p>
            </ResumenPieza>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
