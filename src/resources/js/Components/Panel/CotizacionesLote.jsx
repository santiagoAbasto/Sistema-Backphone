import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { ArrowLeft, Check, Copy, Info, MessageCircle } from 'lucide-react';
import { Badge, EmptyState, buttonCls } from '@/Components/Admin/ui';
import { fmtTelefono, numeroCotizacion } from '@/Components/Admin/cotizacion';

export default function CotizacionesLote({ links = [], omitidas = [], Layout, prefijo = 'admin' }) {
  const [copiado, setCopiado] = useState(null);
  const [abiertos, setAbiertos] = useState([]);

  const copiar = async (item) => {
    try {
      await navigator.clipboard.writeText(item.mensaje);
      setCopiado(item.id);
      setTimeout(() => setCopiado((actual) => (actual === item.id ? null : actual)), 2000);
    } catch {
      /* el navegador no dio permiso para copiar */
    }
  };

  const marcarAbierto = (id) => setAbiertos((a) => (a.includes(id) ? a : [...a, id]));

  return (
    <Layout title="Enviar cotizaciones por WhatsApp">
      <Head title="Enviar cotizaciones por WhatsApp" />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <div className="flex items-center gap-3">
          <Link href={route(`${prefijo}.cotizaciones.index`)} aria-label="Volver a cotizaciones"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-carbon-900" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Enviar por WhatsApp
            </h1>
            <p className="text-sm text-gris-500">Cada botón abre el chat del cliente con el mensaje listo; solo falta presionar enviar.</p>
          </div>
        </div>

        {links.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-gris-200 bg-white px-5 py-4 text-sm shadow-sutil">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--acento)]" />
            <div className="space-y-1">
              <p className="font-semibold text-gris-900">
                {links.length} {links.length === 1 ? 'mensaje listo' : 'mensajes listos'} · {abiertos.length} {abiertos.length === 1 ? 'abierto' : 'abiertos'}
              </p>
              <p className="text-gris-500">WhatsApp abre un chat a la vez: ve uno por uno. Los que ya abriste quedan marcados.</p>
              {omitidas.length > 0 && (
                <p className="font-semibold text-amber-700">Sin número de WhatsApp válido: {omitidas.join(', ')}.</p>
              )}
            </div>
          </div>
        )}

        {links.length === 0 ? (
          <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
            <EmptyState icon={MessageCircle} title="No hay mensajes para enviar"
              text={omitidas.length > 0
                ? `Estas cotizaciones no tienen un número de WhatsApp válido: ${omitidas.join(', ')}.`
                : 'No se eligió ninguna cotización.'}
              action={<Link href={route(`${prefijo}.cotizaciones.index`)} className={buttonCls('secondary')}>Volver a cotizaciones</Link>} />
          </section>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {links.map((item) => {
              const abierto = abiertos.includes(item.id);
              return (
                <li key={item.id}
                  className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sutil transition-colors ${abierto ? 'border-emerald-300' : 'border-gris-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-gris-900">{item.nombre}</p>
                      <p className="mt-0.5 text-xs text-gris-500">{fmtTelefono(item.telefono)} · Bs {item.total}</p>
                    </div>
                    <Badge tone="lila" className="cifra">{numeroCotizacion(item.id)}</Badge>
                  </div>

                  <div className="mt-4 flex-1 whitespace-pre-wrap break-words rounded-xl bg-gris-50 p-3.5 text-[13px] leading-relaxed text-gris-700">
                    {item.mensaje}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a href={route(`${prefijo}.cotizaciones.enviar-whatsapp-libre`, { id: item.id })} target="_blank" rel="noopener noreferrer"
                      onClick={() => marcarAbierto(item.id)} className={buttonCls('success', 'h-10 flex-1')}>
                      {abierto ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                      {abierto ? 'Abierto · abrir otra vez' : 'Abrir WhatsApp'}
                    </a>
                    <button type="button" onClick={() => copiar(item)} className={buttonCls('secondary', 'h-10')}>
                      {copiado === item.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      {copiado === item.id ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}
