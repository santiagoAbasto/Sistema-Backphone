import { useForm } from '@inertiajs/react';
import { Lock, Mail, User, UserPlus } from 'lucide-react';
import AuthShell from '@/Components/Auth/AuthShell';
import { AuthAlert, AuthButton, AuthField, PasswordMatch, PasswordStrength } from '@/Components/Auth/AuthUI';

// Solo un administrador llega aquí (ruta /admin/register): crea cuentas para su equipo.
export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('register'), { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <AuthShell
            pageTitle="Crear usuario"
            title="Crear usuario del equipo"
            subtitle="La persona podrá entrar al panel con este correo y contraseña."
            icon={UserPlus}
            back={{ href: route('admin.dashboard'), label: 'Volver al panel' }}
            aside={{
                eyebrow: 'Tu equipo',
                heading: 'Suma a alguien a tu equipo en un minuto',
                text: 'Cada persona tiene su propia cuenta, así sabes quién registró cada venta y cada movimiento.',
                bullets: ['Cuenta personal para cada vendedor', 'Contraseña segura desde el inicio', 'Tú decides quién tiene acceso'],
            }}
        >
            <AuthAlert tone="info">La cuenta se crea con permisos de <strong>vendedor</strong>.</AuthAlert>

            <form onSubmit={submit} className="space-y-5" noValidate>
                <AuthField
                    id="name"
                    label="Nombre completo"
                    icon={User}
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                    autoComplete="name"
                    placeholder="Ej.: María Rojas"
                    autoFocus
                />

                <AuthField
                    id="email"
                    label="Correo electrónico"
                    type="email"
                    icon={Mail}
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    autoComplete="off"
                    placeholder="nombre@correo.com"
                    hint="Con este correo iniciará sesión."
                />

                <AuthField
                    id="password"
                    label="Contraseña"
                    icon={Lock}
                    toggle
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="new-password"
                    placeholder="Crea una contraseña segura"
                >
                    <PasswordStrength password={data.password} />
                </AuthField>

                <AuthField
                    id="password_confirmation"
                    label="Repite la contraseña"
                    icon={Lock}
                    toggle
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation}
                    autoComplete="new-password"
                    placeholder="Escríbela otra vez"
                >
                    <PasswordMatch password={data.password} confirmation={data.password_confirmation} />
                </AuthField>

                <AuthButton loading={processing} loadingText="Creando usuario…">Crear usuario</AuthButton>
            </form>
        </AuthShell>
    );
}
