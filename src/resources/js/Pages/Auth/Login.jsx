import { Link, useForm } from '@inertiajs/react';
import { Lock, Mail } from 'lucide-react';
import AuthShell from '@/Components/Auth/AuthShell';
import { AuthAlert, AuthButton, AuthCheckbox, AuthField, linkCls } from '@/Components/Auth/AuthUI';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    return (
        <AuthShell
            pageTitle="Iniciar sesión"
            title="Inicia sesión"
            subtitle="Ingresa con el correo y la contraseña de tu cuenta del equipo."
            footer={<>¿No tienes cuenta? Pedile al administrador del sistema que te cree una.</>}
        >
            {status && <AuthAlert>{status}</AuthAlert>}

            <form onSubmit={submit} className="space-y-5" noValidate>
                <AuthField
                    id="email"
                    label="Correo electrónico"
                    type="email"
                    icon={Mail}
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    autoComplete="username"
                    placeholder="nombre@correo.com"
                    autoFocus
                />

                <AuthField
                    id="password"
                    label="Contraseña"
                    icon={Lock}
                    toggle
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    action={canResetPassword && (
                        <Link href={route('password.request')} className={`text-[13px] ${linkCls}`}>
                            ¿La olvidaste?
                        </Link>
                    )}
                />

                <AuthCheckbox id="remember" checked={data.remember} onChange={(e) => setData('remember', e.target.checked)}>
                    Mantener la sesión iniciada en este equipo
                </AuthCheckbox>

                <AuthButton loading={processing} loadingText="Ingresando…">Iniciar sesión</AuthButton>
            </form>
        </AuthShell>
    );
}
