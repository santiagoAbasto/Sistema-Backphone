import { useForm } from '@inertiajs/react';
import { Lock, ShieldCheck } from 'lucide-react';
import AuthShell from '@/Components/Auth/AuthShell';
import { AuthButton, AuthField } from '@/Components/Auth/AuthUI';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ password: '' });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.confirm'), { onFinish: () => reset('password') });
    };

    return (
        <AuthShell
            pageTitle="Confirma tu contraseña"
            title="Confirma que eres tú"
            subtitle="Esta es una sección protegida. Escribe tu contraseña para continuar."
            icon={ShieldCheck}
        >
            <form onSubmit={submit} className="space-y-5" noValidate>
                <AuthField
                    id="password"
                    label="Contraseña"
                    icon={Lock}
                    toggle
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="current-password"
                    autoFocus
                />
                <AuthButton loading={processing} loadingText="Confirmando…">Continuar</AuthButton>
            </form>
        </AuthShell>
    );
}
