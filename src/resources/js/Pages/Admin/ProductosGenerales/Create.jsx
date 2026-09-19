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
  CamposProductoGeneral, ResumenProductoGeneral, datosDesde, payloadDe, siguienteCodigo, useCodigoDisponible,
  useFormularioProductoGeneral, validarProductoGeneral,
} from '@/Components/Admin/productos-generales';

export default function Create({ sugerencias = {} }) {
  const form = useFormularioProductoGeneral(datosDesde(null));
  const { data, setData, errores, setErrores } = form;
  const estadoCodigo = useCodigoDisponible(data.codigo);
  const [guardando, setGuardando] = useState(null);
  const [registrados, setRegistrados] = useState(0);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();
  const refs = { nombre: useRef(null), codigo: useRef(null) };

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  // «Registrar otro» vuelve a esta página con todo igual y el siguiente código de la serie
  const guardar = (otro = false) => {
    if (guardando) return;
    const e = validarProductoGeneral(data);
    if (!e.codigo && estadoCodigo === 'ocupado') e.codigo = 'Ya hay un producto con este código.';
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    const enviado = payloadDe(data);
    router.post(route('admin.productos-generales.store'), {
      ...enviado,
      ...(otro ? { return_to: route('admin.productos-generales.create', undefined, false) } : {}),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(otro ? 'otro' : 'listado'),
      onSuccess: () => {
        notifyRecordsUpdated();
        if (!otro) return;
        setRegistrados((n) => n + 1);
        setData((d) => ({ ...d, codigo: siguienteCodigo(enviado.codigo) }));
        setErrores({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => refs.codigo.current?.select(), 300);
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
      <Head title="Registrar producto general" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.productos-generales.index')} volverLabel="Volver a productos generales"
          titulo="Registrar producto general" subtitulo="Fundas, vidrios, cargadores y accesorios: cada unidad con su código." />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposProductoGeneral form={form} sugerencias={sugerencias} pasos refs={refs} estadoCodigo={estadoCodigo} />
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenProductoGeneral data={data}>
              <ErroresResumen errores={errores} />
              <button type="button" onClick={() => guardar(false)} disabled={Boolean(guardando)} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando === 'listado' ? 'Guardando…' : 'Guardar producto'}
              </button>
              <button type="button" onClick={() => guardar(true)} disabled={Boolean(guardando)} className={buttonCls('secondary', 'h-11 w-full')}>
                <CopyPlus className="h-4 w-4" /> {guardando === 'otro' ? 'Guardando…' : 'Guardar y registrar otro'}
              </button>
              <p className="text-center text-xs leading-relaxed text-gris-400">
                «Registrar otro» mantiene el tipo, el nombre, los precios y la procedencia, y propone el siguiente código (FUNDA_1 → FUNDA_2).
                {registrados > 0 && <span className="mt-1 block font-semibold text-emerald-700">Llevas {registrados} {registrados === 1 ? 'producto registrado' : 'productos registrados'} seguidos.</span>}
              </p>
            </ResumenProductoGeneral>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
