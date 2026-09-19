import { useForm } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { Building2, Check, MapPin, Phone } from 'lucide-react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Button, Card, Field, Input, PageHeader, Toast, useToast } from '@/Components/Admin/ui';

/**
 * Ajustes → Datos del negocio.
 *
 * Lo que se escribe acá es lo que sale impreso en boletas, cotizaciones y reportes, y lo que
 * el panel muestra en su encabezado. Un solo formulario, en tres bloques, con una vista previa
 * de cómo queda la cabecera de un comprobante.
 */
const BLOQUES = [
    {
        clave: 'identidad',
        titulo: 'Identidad',
        subtitulo: 'El nombre con el que el negocio se presenta en cada documento.',
        icono: Building2,
        campos: [
            { name: 'negocio_nombre',  label: 'Nombre del negocio', max: 120, requerido: true, ayuda: 'Va arriba de toda boleta y cotización.' },
            { name: 'negocio_eslogan', label: 'Eslogan',            max: 160, ayuda: 'Opcional. Una línea corta debajo del nombre.' },
            { name: 'negocio_nit',     label: 'NIT o identificación tributaria', max: 40 },
            { name: 'moneda_simbolo',  label: 'Símbolo de la moneda', max: 6, requerido: true, ayuda: 'Con lo que se muestran los montos. Por ejemplo: Bs.' },
        ],
    },
    {
        clave: 'contacto',
        titulo: 'Contacto',
        subtitulo: 'Cómo te encuentra el cliente cuando mira un comprobante.',
        icono: Phone,
        campos: [
            { name: 'negocio_telefono', label: 'Teléfono',  max: 40 },
            { name: 'negocio_whatsapp', label: 'WhatsApp',  max: 40, ayuda: 'Con código de país, sin espacios. Por ejemplo: 59170000000.' },
            { name: 'negocio_email',    label: 'Correo de contacto', max: 160, type: 'email' },
        ],
    },
    {
        clave: 'ubicacion',
        titulo: 'Ubicación y horario',
        subtitulo: 'La dirección que se imprime y el horario en el que atendés.',
        icono: MapPin,
        campos: [
            { name: 'negocio_direccion', label: 'Dirección', max: 200 },
            { name: 'negocio_ciudad',    label: 'Ciudad',    max: 100 },
            { name: 'negocio_pais',      label: 'País',      max: 100 },
            { name: 'negocio_horario',   label: 'Horario de atención', max: 160, ayuda: 'Por ejemplo: lunes a sábado, de 9:00 a 19:00.' },
        ],
    },
];

/** Cómo queda la cabecera de un comprobante con lo que hay escrito ahora. */
function VistaComprobante({ datos }) {
    const nombre = (datos.negocio_nombre ?? '').trim() || 'Blackphone';
    const linea = [datos.negocio_direccion, datos.negocio_ciudad, datos.negocio_pais].filter(Boolean).join(', ');
    const contacto = [datos.negocio_telefono || datos.negocio_whatsapp, datos.negocio_email].filter(Boolean).join(' · ');

    return (
        <div className="overflow-hidden rounded-[12px] border border-gris-200 bg-white">
            <div className="border-b border-gris-200 bg-gris-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gris-500">
                Así se ve la cabecera de una boleta
            </div>
            <div className="px-5 py-5 text-center">
                <p className="font-marca text-[22px] font-bold uppercase tracking-[0.12em] text-gris-900">{nombre}</p>
                {datos.negocio_eslogan && <p className="mt-1 text-[12px] italic text-gris-500">{datos.negocio_eslogan}</p>}
                {datos.negocio_nit && <p className="mt-2 text-[12px] text-gris-600">NIT {datos.negocio_nit}</p>}
                {linea && <p className="mt-1 text-[12px] text-gris-600">{linea}</p>}
                {contacto && <p className="mt-1 text-[12px] text-gris-600">{contacto}</p>}
                {datos.negocio_horario && <p className="mt-1 text-[12px] text-gris-500">{datos.negocio_horario}</p>}
                {!linea && !contacto && (
                    <p className="mt-3 text-[12px] text-gris-400">
                        Completá el contacto y la dirección: sin eso, el comprobante sale solo con el nombre.
                    </p>
                )}
            </div>
        </div>
    );
}

export default function Negocio({ valores }) {
    const [toast, avisar] = useToast();
    const { data, setData, post, processing, errors, isDirty } = useForm({ ...valores });

    const guardar = (e) => {
        e.preventDefault();
        post(route('admin.configuracion.negocio.update'), {
            preserveScroll: true,
            onSuccess: () => avisar('Datos del negocio guardados.'),
        });
    };

    return (
        <AdminLayout title="Datos del negocio">
            <form onSubmit={guardar} className="mx-auto max-w-5xl">
                <PageHeader
                    title="Datos del negocio"
                    subtitle="Lo que se escribe acá se imprime en boletas, cotizaciones y reportes."
                    actions={
                        <Button type="submit" variant="primary" disabled={processing || !isDirty}>
                            <Check className="h-4 w-4" /> {processing ? 'Guardando…' : 'Guardar cambios'}
                        </Button>
                    }
                />

                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-5">
                        {BLOQUES.map(({ clave, titulo, subtitulo, icono: Icono, campos }) => (
                            <Card
                                key={clave}
                                title={
                                    <span className="flex items-center gap-2">
                                        <Icono className="h-4 w-4 text-[color:var(--acento)]" /> {titulo}
                                    </span>
                                }
                                subtitle={subtitulo}
                            >
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {campos.map((campo) => (
                                        <Field
                                            key={campo.name}
                                            label={campo.requerido ? `${campo.label} *` : campo.label}
                                            hint={campo.ayuda}
                                            value={data[campo.name] ?? ''}
                                            max={campo.max}
                                            error={errors[campo.name]}
                                        >
                                            <Input
                                                type={campo.type ?? 'text'}
                                                value={data[campo.name] ?? ''}
                                                maxLength={campo.max}
                                                onChange={(e) => setData(campo.name, e.target.value)}
                                                aria-invalid={errors[campo.name] ? 'true' : undefined}
                                            />
                                        </Field>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>

                    <aside className="lg:sticky lg:top-24 lg:self-start">
                        <VistaComprobante datos={data} />
                        <p className="mt-3 px-1 text-[12px] leading-relaxed text-gris-500">
                            El nombre nunca queda vacío: si lo borrás, los documentos vuelven a decir «Blackphone».
                        </p>
                    </aside>
                </div>
            </form>

            <Toast toast={toast} />
        </AdminLayout>
    );
}
