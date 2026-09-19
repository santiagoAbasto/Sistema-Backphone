import { useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { route } from 'ziggy-js';
import { Building2, Check, Lock, Pencil, Plus, Power, Trash2, Users } from 'lucide-react';
import AdminLayout from '@/Layouts/AdminLayout';
import {
    Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Switch, Toast, buttonCls, useToast,
} from '@/Components/Admin/ui';
import { IconoLocal, IconoUbicacion, IlustracionSucursales } from '@/Components/Marca/IconosSucursal';

const VACIA = { nombre: '', prefijo: '', ciudad: '', direccion: '', telefono: '' };

/** El prefijo se escribe siempre en mayúsculas y sin signos: es lo que va en cada código de nota. */
const limpiarPrefijo = (valor) => (valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function FormularioSucursal({ form, esNueva }) {
    const { data, setData, errors } = form;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label="Nombre *" hint="Como la llaman en el día a día." value={data.nombre} max={80} error={errors.nombre}>
                    <Input value={data.nombre} maxLength={80} autoFocus onChange={(e) => setData('nombre', e.target.value)} />
                </Field>

                <Field
                    label="Prefijo *"
                    hint={`Va adelante de cada código: ${data.prefijo || 'CBA'}-V001.`}
                    value={data.prefijo}
                    max={6}
                    error={errors.prefijo}
                >
                    <Input
                        value={data.prefijo}
                        maxLength={6}
                        className="cifra uppercase"
                        placeholder="CBA"
                        onChange={(e) => setData('prefijo', limpiarPrefijo(e.target.value))}
                    />
                </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ciudad" value={data.ciudad} max={80} error={errors.ciudad}>
                    <Input value={data.ciudad} maxLength={80} onChange={(e) => setData('ciudad', e.target.value)} />
                </Field>
                <Field label="Teléfono" value={data.telefono} max={40} error={errors.telefono}>
                    <Input value={data.telefono} maxLength={40} onChange={(e) => setData('telefono', e.target.value)} />
                </Field>
            </div>

            <Field label="Dirección" value={data.direccion} max={200} error={errors.direccion}>
                <Input value={data.direccion} maxLength={200} onChange={(e) => setData('direccion', e.target.value)} />
            </Field>

            {esNueva && (
                <p className="rounded-[10px] bg-bronce-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-bronce-800">
                    La sucursal arranca vacía y con su propio contador: su primera venta será{' '}
                    <span className="cifra font-semibold">{data.prefijo || 'XXX'}-V001</span>. El inventario, los
                    clientes y las ventas de cada sucursal son suyos y no se mezclan.
                </p>
            )}
        </div>
    );
}

function FilaSucursal({ sucursal, onEditar, onEncender, onBorrar, puedeApagar }) {
    const { nombre, prefijo, ciudad, direccion, telefono, activa, personas, movimiento } = sucursal;

    return (
        <li className={`flex flex-wrap items-center gap-4 px-5 py-4 ${activa ? '' : 'bg-gris-50'}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${
                activa ? 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]' : 'bg-gris-200 text-gris-400'
            }`}>
                <IconoLocal className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${activa ? 'text-gris-900' : 'text-gris-500'}`}>{nombre}</span>
                    <span className="cifra rounded bg-gris-100 px-1.5 py-px text-[10px] font-semibold text-gris-600">{prefijo}</span>
                    {!activa && <Badge tone="slate">Apagada</Badge>}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-gris-500">
                    {ciudad && <span className="inline-flex items-center gap-1"><IconoUbicacion className="h-3.5 w-3.5" /> {ciudad}</span>}
                    {direccion && <span className="truncate">{direccion}</span>}
                    {telefono && <span className="cifra">{telefono}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {personas} {personas === 1 ? 'persona' : 'personas'}</span>
                </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button variant="secondary" className="h-9" onClick={() => onEditar(sucursal)}>
                    <Pencil className="h-4 w-4" /> Editar
                </Button>

                <button
                    type="button"
                    onClick={() => onEncender(sucursal)}
                    disabled={activa && !puedeApagar}
                    title={activa && !puedeApagar ? 'Tiene que quedar al menos una sucursal encendida' : undefined}
                    className={buttonCls('secondary', 'h-9 disabled:cursor-not-allowed')}
                >
                    <Power className="h-4 w-4" /> {activa ? 'Apagar' : 'Encender'}
                </button>

                {movimiento || personas > 0 ? (
                    <span
                        className={buttonCls('secondary', 'h-9 cursor-not-allowed opacity-60')}
                        title={movimiento ? `Tiene ${movimiento}` : 'Tiene cuentas asignadas'}
                    >
                        <Lock className="h-4 w-4" />
                    </span>
                ) : (
                    <button type="button" onClick={() => onBorrar(sucursal)} className={buttonCls('danger', 'h-9')} aria-label={`Eliminar ${nombre}`}>
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        </li>
    );
}

export default function SucursalesIndex({ sucursales = [], superAdmins = 0 }) {
    const [toast, avisar] = useToast();
    const [editando, setEditando] = useState(null);   // null | 'nueva' | {…}
    const [borrando, setBorrando] = useState(null);

    const form = useForm(VACIA);
    const encendidas = useMemo(() => sucursales.filter((s) => s.activa).length, [sucursales]);

    const abrirNueva = () => { form.setData(VACIA); form.clearErrors(); setEditando('nueva'); };
    const abrirEdicion = (s) => {
        form.setData({ nombre: s.nombre, prefijo: s.prefijo, ciudad: s.ciudad ?? '', direccion: s.direccion ?? '', telefono: s.telefono ?? '' });
        form.clearErrors();
        setEditando(s);
    };

    const guardar = (e) => {
        e.preventDefault();
        const opciones = { preserveScroll: true, onSuccess: () => setEditando(null) };

        if (editando === 'nueva') form.post(route('admin.sucursales.store'), opciones);
        else form.patch(route('admin.sucursales.update', editando.id), opciones);
    };

    const encender = (s) => form.patch(route('admin.sucursales.visibilidad', s.id), { preserveScroll: true });

    const confirmarBorrado = () => {
        form.delete(route('admin.sucursales.destroy', borrando.id), {
            preserveScroll: true,
            onFinish: () => setBorrando(null),
        });
    };

    return (
        <AdminLayout title="Sucursales">
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    title="Sucursales"
                    subtitle="Cada sucursal lleva su inventario, sus ventas y sus códigos de nota. Quien tiene una asignada ve solo la suya."
                    actions={
                        <Button variant="primary" onClick={abrirNueva}>
                            <Plus className="h-4 w-4" /> Nueva sucursal
                        </Button>
                    }
                />

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <Card>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-500">Encendidas</p>
                        <p className="mt-1 font-marca text-[28px] font-bold leading-none text-gris-900">{encendidas}</p>
                        <p className="mt-1 text-xs text-gris-500">de {sucursales.length} cargadas</p>
                    </Card>
                    <Card>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-500">Super administradores</p>
                        <p className="mt-1 font-marca text-[28px] font-bold leading-none text-gris-900">{superAdmins}</p>
                        <p className="mt-1 text-xs text-gris-500">ven todas las sucursales</p>
                    </Card>
                    <Card>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-500">Personas asignadas</p>
                        <p className="mt-1 font-marca text-[28px] font-bold leading-none text-gris-900">
                            {sucursales.reduce((n, s) => n + s.personas, 0)}
                        </p>
                        <p className="mt-1 text-xs text-gris-500">trabajan en una sola</p>
                    </Card>
                </div>

                <section className="mt-5 overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil">
                    <header className="flex items-center gap-2 border-b border-gris-100 px-5 py-3.5">
                        <Building2 className="h-[18px] w-[18px] text-[color:var(--acento)]" />
                        <h2 className="text-[15px] font-semibold text-gris-900">Listado de sucursales</h2>
                    </header>

                    {sucursales.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-10 text-center">
                            <IlustracionSucursales className="h-36 w-auto" />
                            <EmptyState
                                title="Todavía no hay sucursales"
                                text="Creá la primera para empezar a cargar inventario y vender."
                                action={<Button variant="primary" onClick={abrirNueva}><Plus className="h-4 w-4" /> Nueva sucursal</Button>}
                            />
                        </div>
                    ) : (
                        <ul className="divide-y divide-gris-100">
                            {sucursales.map((s) => (
                                <FilaSucursal
                                    key={s.id}
                                    sucursal={s}
                                    onEditar={abrirEdicion}
                                    onEncender={encender}
                                    onBorrar={setBorrando}
                                    puedeApagar={encendidas > 1}
                                />
                            ))}
                        </ul>
                    )}
                </section>

                <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-gris-500">
                    Una sucursal con movimiento no se borra: se apaga. Así deja de aparecer en el selector y de
                    recibir registros nuevos, pero su historial queda intacto.
                </p>
            </div>

            {editando && (
                <Modal
                    title={editando === 'nueva' ? 'Nueva sucursal' : `Editar ${editando.nombre}`}
                    onClose={() => setEditando(null)}
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                            <Button variant="primary" onClick={guardar} disabled={form.processing}>
                                <Check className="h-4 w-4" /> {form.processing ? 'Guardando…' : 'Guardar'}
                            </Button>
                        </>
                    }
                >
                    <form onSubmit={guardar}>
                        <FormularioSucursal form={form} esNueva={editando === 'nueva'} />
                    </form>
                </Modal>
            )}

            {borrando && (
                <Modal
                    title={`Eliminar ${borrando.nombre}`}
                    onClose={() => setBorrando(null)}
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setBorrando(null)}>Cancelar</Button>
                            <Button variant="danger" onClick={confirmarBorrado} disabled={form.processing}>
                                <Trash2 className="h-4 w-4" /> Eliminar
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm leading-relaxed text-gris-600">
                        La sucursal <strong className="text-gris-900">{borrando.nombre}</strong> no tiene movimiento ni
                        cuentas asignadas, así que se puede borrar. No se puede deshacer.
                    </p>
                </Modal>
            )}

            <Toast toast={toast} />
        </AdminLayout>
    );
}
