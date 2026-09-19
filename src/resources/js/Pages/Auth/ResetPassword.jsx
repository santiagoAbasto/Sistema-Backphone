import { useForm } from '@inertiajs/react';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import AuthShell from '@/Components/Auth/AuthShell';
import { AuthButton, AuthField, PasswordMatch, PasswordStrength } from '@/Components/Auth/AuthUI';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.store'), { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <AuthShell
            pageTitle="Nueva contraseña"
            title="Crea una nueva contraseña"
            subtitle="Elige una contraseña que no uses en otros sitios."
            icon={ShieldCheck}
            back={{ href: route('login'), label: 'Volver a iniciar sesión' }}
        >
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
                />

                <AuthField
                    id="password"
                    label="Nueva contraseña"
                    icon={Lock}
                    toggle
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="new-password"
                    autoFocus
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
                >
                    <PasswordMatch password={data.password} confirmation={data.password_confirmation} />
                </AuthField>

                <AuthButton loading={processing} loadingText="Guardando…">Guardar contraseña</AuthButton>
            </form>
        </AuthShell>
    );
}
