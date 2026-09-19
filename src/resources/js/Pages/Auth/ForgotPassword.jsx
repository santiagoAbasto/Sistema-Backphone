import { Link, useForm } from '@inertiajs/react';
import { KeyRound, Mail } from 'lucide-react';
import AuthShell from '@/Components/Auth/AuthShell';
import { AuthAlert, AuthButton, AuthField, linkCls } from '@/Components/Auth/AuthUI';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <AuthShell
            pageTitle="Recuperar contraseña"
            title="¿Olvidaste tu contraseña?"
            subtitle="Escribe tu correo y te enviamos un enlace para crear una nueva."
            icon={KeyRound}
            back={{ href: route('login'), label: 'Volver a iniciar sesión' }}
            footer={<>¿Ya la recordaste? <Link href={route('login')} className={linkCls}>Inicia sesión</Link></>}
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
                <AuthButton loading={processing} loadingText="Enviando…">Enviar enlace</AuthButton>
            </form>
        </AuthShell>
    );
}
