import { Link, useForm } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';
import AuthShell from '@/Components/Auth/AuthShell';
import { AuthAlert, AuthButton, linkCls } from '@/Components/Auth/AuthUI';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    return (
        <AuthShell
            pageTitle="Confirma tu correo"
            title="Confirma tu correo"
            subtitle="Te enviamos un enlace a tu correo. Ábrelo para activar tu cuenta. Si no lo ves, revisa la carpeta de spam."
            icon={MailCheck}
            footer={
                <Link href={route('logout')} method="post" as="button" className={linkCls}>
                    Cerrar sesión
                </Link>
            }
        >
            {status === 'verification-link-sent' && (
                <AuthAlert>Te enviamos un nuevo enlace de confirmación.</AuthAlert>
            )}

            <form onSubmit={submit}>
                <AuthButton loading={processing} loadingText="Enviando…">Enviar el enlace otra vez</AuthButton>
            </form>
        </AuthShell>
    );
}
