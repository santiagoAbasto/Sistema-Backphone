import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { History, Trash2 } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Card, Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import { EncabezadoFormulario, ErroresResumen, ModalEliminar } from '@/Components/Admin/inventario';
import {
  CamposPieza, HistorialPieza, IconoPieza, ModalStock, ResumenPieza, datosDesde, payloadDe, useFormularioPieza, validarPieza,
} from '@/Components/Admin/piezas';

export default function Edit({ pieza, movimientos = [], bloqueo = null, categorias = [], sugerencias = [] }) {
  const form = useFormularioPieza(datosDesde(pieza));
  const { data, errores, setErrores } = form;
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [movimiento, setMovimiento] = useState(null);
  const [notice, setNotice] = useState(null);
  const [toast] = useToast();

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });

  const guardar = () => {
    if (guardando) return;
    // La cantidad no se valida: en la edición no se toca el saldo, se mueve por «Ingresar» o «Ajustar».
    const e = validarPieza(data, { conCantidad: false });
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    const { cantidad: _saldo, ...enviado } = payloadDe(data);
    router.put(route('admin.piezas.update', pieza.id), enviado, {
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
    if (borrando) return;
    router.delete(route('admin.piezas.destroy', pieza.id), {
      onStart: () => setBorrando(true),
      onSuccess: () => notifyRecordsUpdated(),
      onFinish: () => { setBorrando(false); setConfirmar(false); },
    });
  };

  return (
    <AdminLayout title={pieza.nombre}>
      <Head title={pieza.nombre} />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <EncabezadoFormulario volverUrl={route('admin.piezas.index')} volverLabel="Volver a piezas y repuestos"
          titulo={pieza.nombre} subtitulo={[pieza.categoria, pieza.compatibilidad].filter(Boolean).join(' · ') || 'Pieza del inventario'} />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <CamposPieza form={form} categorias={categorias} sugerencias={sugerencias} edicion
              saldo={pieza.cantidad} onMoverStock={(accion) => setMovimiento(accion)} />

            <Card title="Historial de la pieza" subtitle="Cada unidad que entró o salió, con su motivo y cómo quedó el saldo."
              actions={<History className="h-[18px] w-[18px] text-gris-400" />}>
              <HistorialPieza movimientos={movimientos} />
            </Card>

            <Card title="Eliminar del inventario"
              subtitle={bloqueo ?? 'Se borra la pieza y su historial. Si ya salió alguna vez, conviene archivarla en lugar de borrarla.'}>
              <button type="button" onClick={() => setConfirmar(true)} disabled={Boolean(bloqueo)}
                className={buttonCls('danger', 'h-11')}>
                <Trash2 className="h-4 w-4" /> Eliminar pieza
              </button>
            </Card>
          </div>

          <aside className="xl:sticky xl:top-24">
            <ResumenPieza data={data} saldo={pieza.cantidad}>
              <ErroresResumen errores={errores} />
              <button type="button" onClick={guardar} disabled={guardando} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </ResumenPieza>
          </aside>
        </div>
      </div>

      {movimiento && (
        <ModalStock pieza={pieza} accion={movimiento} onCerrar={() => setMovimiento(null)} />
      )}

      {confirmar && (
        <ModalEliminar titulo="Eliminar pieza" icon={IconoPieza} nombre={pieza.nombre}
          detalle={[pieza.categoria, pieza.compatibilidad, pieza.codigo].filter(Boolean).join(' · ')}
          procesando={borrando} onConfirmar={eliminar} onCerrar={() => setConfirmar(false)} />
      )}
    </AdminLayout>
  );
}
