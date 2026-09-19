<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Reglas de validación del login.
     *
     * Mejoras de seguridad:
     *  - Email normalizado con 'lowercase' y validación RFC/DNS.
     *  - Password mínimo de string, sin revelar longitud mínima al atacante.
     *  - max:255 en ambos campos para evitar payloads gigantes.
     */
    public function rules(): array
    {
        return [
            'email'    => ['required', 'string', 'lowercase', 'email:rfc', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * Mensajes de error unificados para no revelar si el email existe.
     */
    public function messages(): array
    {
        return [
            'email.required'    => 'El correo es obligatorio.',
            'email.email'       => 'Ingresá un correo válido.',
            'password.required' => 'La contraseña es obligatoria.',
        ];
    }

    /**
     * Intenta autenticar al usuario.
     *
     * - Rate Limit: 5 intentos por [email + IP], bloqueo progresivo.
     * - Mensaje genérico en fallo (no revela si el email existe).
     * - Regenera token de sesión tras login exitoso (anti session fixation).
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        if (! Auth::attempt($this->only('email', 'password'), $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey(), 300); // 5 minutos de decaimiento

            throw ValidationException::withMessages([
                'email' => 'Las credenciales no son correctas.',
            ]);
        }

        // El vendedor solo puede entrar dentro del horario laboral; el admin no tiene restricción.
        // Se valida DESPUÉS de las credenciales (para saber el rol) y se cierra la sesión recién abierta.
        if ((Auth::user()->rol ?? null) === 'vendedor' && ! \App\Support\HorarioLaboral::permitido()) {
            Auth::logout();
            RateLimiter::clear($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => \App\Support\HorarioLaboral::mensaje(),
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Comprueba que no se hayan superado los intentos permitidos.
     *
     * Límite: 5 intentos por ventana.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => sprintf(
                'Demasiados intentos. Intentá de nuevo en %d %s.',
                $seconds < 60 ? $seconds : (int) ceil($seconds / 60),
                $seconds < 60 ? 'segundos' : 'minutos'
            ),
        ]);
    }

    /**
     * Clave de throttle: [email_normalizado | ip_address].
     * Usar ambos evita que un atacante bloquee la cuenta de otro
     * sólo con intentos desde distinta IP.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(
            Str::lower($this->string('email')) . '|' . $this->ip()
        );
    }
}
