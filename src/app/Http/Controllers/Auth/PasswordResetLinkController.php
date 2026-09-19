<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $status = Password::sendResetLink(
            $request->only('email')
        );

        // Respuesta neutra: nunca revelamos si el correo existe o no (evita enumerar cuentas).
        // Si el email existe se envía el enlace; en cualquier otro caso mostramos el mismo mensaje.
        // Solo el límite de intentos (throttle) se informa aparte, porque no revela existencia.
        if ($status === Password::RESET_THROTTLED) {
            throw ValidationException::withMessages([
                'email' => [trans($status)],
            ]);
        }

        return back()->with('status', 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.');
    }
}
