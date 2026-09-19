import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { route } from 'ziggy-js';
import {
    AtSign, Building2, CalendarDays, Camera, Check, Eye, EyeOff, KeyRound, ShieldCheck, Target, Trash2,
} from 'lucide-react';
import AdminLayout from '@/Layouts/AdminLayout';
import VendedorLayout from '@/Layouts/VendedorLayout';
import { Button, Card, Field, Input, PageHeader, Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import Avatar from '@/Components/Panel/Avatar';
import { IconoLocal } from '@/Components/Marca/IconosSucursal';

const MAXIMO_MB = 5;

const fechaLarga = (iso) => (iso
    ? new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—');

/* ─── Foto de perfil ───────────────────────────────────────────────────────── */

function BloqueFoto({ cuenta, avisar }) {
    const entrada = useRef(null);
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState(null);
    // Se muestra la imagen elegida al instante, sin esperar al servidor
    const [previa, setPrevia] = useState(null);

    const elegir = (e) => {
        const archivo = e.target.files?.[0];
        e.target.value = '';
        if (!archivo) return;

        setError(null);

        if (archivo.size > MAXIMO_MB * 1024 * 1024) {
            setError(`La foto pesa más de ${MAXIMO_MB} MB. Probá con una más liviana.`);
            return;
        }

        setPrevia(URL.createObjectURL(archivo));
        setSubiendo(true);

        router.post(route('profile.foto'), { foto: archivo }, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => avisar('Tu foto quedó actualizada.'),
            onError: (errores) => setError(errores.foto ?? 'No se pudo subir la foto.'),
            onFinish: () => { setSubiendo(false); setPrevia(null); },
        });
    };

    const quitar = () => {
        router.delete(route('profile.foto.quitar'), {
            preserveScroll: true,
            onSuccess: () => avisar('Tu foto se quitó: vuelven tus iniciales.'),
        });
    };

    const fotoActual = previa ?? cuenta.foto_url;

    return (
        <Card
            title="Tu foto"
            subtitle="Es la que te identifica en el encabezado del panel. Se recorta en cuadrado."
        >
            <div className="flex flex-wrap items-center gap-5">
                <div className="relative">
                    <Avatar foto={fotoActual} iniciales={cuenta.iniciales} nombre={cuenta.name} tamano="xl" />
                    {subiendo && (
                        <span className="absolute inset-0 grid place-items-center rounded-[20px] bg-carbon-950/60">
                            <svg className="h-6 w-6 animate-spin text-bronce-400" viewBox="0 0 24 24" fill="none" aria-label="Subiendo">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo}
                            className={buttonCls('primary', 'h-10')}>
                            <Camera className="h-4 w-4" /> {cuenta.foto_url ? 'Cambiar foto' : 'Subir foto'}
                        </button>

                        {cuenta.foto_url && (
                            <button type="button" onClick={quitar} disabled={subiendo} className={buttonCls('secondary', 'h-10')}>
                                <Trash2 className="h-4 w-4" /> Quitar
                            </button>
                        )}
                    </div>

                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-gris-500">
                        JPG, PNG o WEBP, hasta {MAXIMO_MB} MB. Se guarda a 256 px: no hace falta que subas una enorme.
                    </p>

                    {error && <p className="mt-2 text-xs font-medium text-peligro">{error}</p>}

                    <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={elegir} aria-label="Elegir una foto de perfil" />
                </div>
            </div>
        </Card>
    );
}

/* ─── Nombre y correo ──────────────────────────────────────────────────────── */

function BloqueDatos({ cuenta, avisar }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        name: cuenta.name ?? '',
        email: cuenta.email ?? '',
    });

    const guardar = (e) => {
        e.preventDefault();
        patch(route('profile.update'), {
            preserveScroll: true,
            onSuccess: () => avisar('Tus datos quedaron guardados.'),
        });
    };

    return (
        <form onSubmit={guardar}>
            <Card
                title="Tus datos"
                subtitle="El nombre es el que queda en cada venta que registres."
                actions={
                    <Button type="submit" variant="primary" disabled={processing || !isDirty}>
                        <Check className="h-4 w-4" /> {processing ? 'Guardando…' : 'Guardar'}
                    </Button>
                }
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre y apellido" value={data.name} max={120} error={errors.name}>
                        <Input value={data.name} maxLength={120} onChange={(e) => setData('name', e.target.value)} />
                    </Field>

                    <Field label="Correo" hint="Con este correo entrás al sistema." value={data.email} max={191} error={errors.email}>
                        <Input type="email" value={data.email} maxLength={191} onChange={(e) => setData('email', e.target.value)} />
                    </Field>
                </div>
            </Card>
        </form>
    );
}

/* ─── Contraseña ───────────────────────────────────────────────────────────── */

function CampoClave({ id, label, hint, error, value, onChange, autoComplete }) {
    const [ver, setVer] = useState(false);

    return (
        <Field label={label} hint={hint} error={error}>
            <div className="relative">
                <Input
                    id={id}
                    type={ver ? 'text' : 'password'}
                    value={value}
                    autoComplete={autoComplete}
                    className="pr-11"
                    onChange={onChange}
                />
                <button
                    type="button"
                    onClick={() => setVer((v) => !v)}
                    aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-gris-100 hover:text-gris-700"
                >
                    {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
        </Field>
    );
}

function BloqueClave({ avisar }) {
    const { data, setData, put, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const guardar = (e) => {
        e.preventDefault();
        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => { reset(); avisar('Tu contraseña quedó cambiada.'); },
            onError: () => reset('password', 'password_confirmation'),
        });
    };

    const completo = data.current_password && data.password && data.password_confirmation;

    return (
        <form onSubmit={guardar}>
            <Card
                title="Tu contraseña"
                subtitle="Cambiala si creés que alguien más la sabe. Al guardarla, tu sesión sigue abierta."
                actions={
                    <Button type="submit" variant="primary" disabled={processing || !completo}>
                        <KeyRound className="h-4 w-4" /> {processing ? 'Guardando…' : 'Cambiar contraseña'}
                    </Button>
                }
            >
                <div className="grid gap-4 sm:grid-cols-3">
                    <CampoClave
                        id="clave-actual"
                        label="La de ahora"
                        error={errors.current_password}
                        value={data.current_password}
                        autoComplete="current-password"
                        onChange={(e) => setData('current_password', e.target.value)}
                    />
                    <CampoClave
                        id="clave-nueva"
                        label="La nueva"
                        hint="Al menos 8 caracteres, con mayúscula, minúscula, número y símbolo."
                        error={errors.password}
                        value={data.password}
                        autoComplete="new-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <CampoClave
                        id="clave-repetir"
                        label="Repetila"
                        error={errors.password_confirmation}
                        value={data.password_confirmation}
                        autoComplete="new-password"
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                    />
                </div>
            </Card>
        </form>
    );
}

/* ─── Lo que decide un administrador ───────────────────────────────────────── */

function Dato({ icono: Icono, etiqueta, valor, detalle }) {
    return (
        <li className="flex items-start gap-3 py-3.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gris-100 text-gris-500">
                <Icono className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gris-500">{etiqueta}</p>
                <p className="mt-0.5 text-[14px] font-medium text-gris-900">{valor}</p>
                {detalle && <p className="mt-0.5 text-[12px] leading-relaxed text-gris-500">{detalle}</p>}
            </div>
        </li>
    );
}

function BloqueAcceso({ cuenta }) {
    return (
        <Card
            title="Tu acceso"
            subtitle="Esto lo define un administrador. Si necesitás otro alcance, pedíselo."
        >
            <ul className="divide-y divide-gris-100">
                <Dato
                    icono={ShieldCheck}
                    etiqueta="Rol"
                    valor={cuenta.rol_nombre}
                    detalle={cuenta.rol_descripcion}
                />
                <Dato
                    icono={cuenta.es_super_admin ? Building2 : IconoLocal}
                    etiqueta="Sucursal"
                    valor={cuenta.es_super_admin ? 'Todas las sucursales' : (cuenta.sucursal ?? 'Sin asignar')}
                    detalle={cuenta.es_super_admin
                        ? 'Ves el negocio completo y elegís con cuál trabajar desde el encabezado.'
                        : 'Ves el inventario, las ventas y los clientes de esta sucursal.'}
                />
                {cuenta.meta_mensual > 0 && (
                    <Dato
                        icono={Target}
                        etiqueta="Meta del mes"
                        valor={`Bs ${cuenta.meta_mensual.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`}
                    />
                )}
                <Dato
                    icono={CalendarDays}
                    etiqueta="En el sistema desde"
                    valor={fechaLarga(cuenta.desde)}
                />
            </ul>
        </Card>
    );
}

/* ─── Página ───────────────────────────────────────────────────────────────── */

export default function Edit({ cuenta }) {
    const [toast, avisar] = useToast();
    const { auth } = usePage().props;

    // Cada quien ve su perfil dentro de su propio panel: el vendedor no entra al de administración.
    const Layout = auth?.user?.rol === 'vendedor' ? VendedorLayout : AdminLayout;

    return (
        <Layout title="Mi perfil">
            <Head title="Mi perfil" />

            <div className="bp-reset mx-auto max-w-4xl">
                <PageHeader
                    title="Mi perfil"
                    subtitle="Tus datos, tu foto y tu contraseña. Todo lo demás lo define un administrador."
                />

                <div className="mt-6 space-y-5">
                    <BloqueFoto cuenta={cuenta} avisar={avisar} />
                    <BloqueDatos cuenta={cuenta} avisar={avisar} />
                    <BloqueClave avisar={avisar} />
                    <BloqueAcceso cuenta={cuenta} />
                </div>

                <p className="mt-5 flex items-start gap-2 px-1 text-[12.5px] leading-relaxed text-gris-500">
                    <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Tu cuenta no se borra desde acá: las ventas y los servicios que registraste quedan a tu nombre.
                    Si alguien deja el equipo, un administrador le quita el acceso desde Usuarios y roles.
                </p>
            </div>

            <Toast toast={toast} />
        </Layout>
    );
}
