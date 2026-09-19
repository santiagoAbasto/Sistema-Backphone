<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Muestra el formulario de registro.
     * ⚠️  Solo accesible para admins autenticados (middleware en auth.php).
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Procesa el registro de un nuevo usuario.
     *
     * Protecciones aplicadas:
     *  - Throttle de 5 intentos / minuto por IP (configurado en auth.php)
     *  - Validación completa del nombre (sin scripts)
     *  - Email único y normalizado a minúsculas
     *  - Contraseña: mínimo 8 chars, mayúscula, minúscula, número, símbolo
     *  - El rol SIEMPRE se asigna como 'vendedor' desde el servidor (no viene del cliente)
     *  - Contraseña hasheada con bcrypt (cast en el modelo)
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => [
                'required',
                'string',
                'min:2',
                'max:100',
                // Bloquear inyección de HTML / scripts en el nombre
                'regex:/^[\pL\s\-\'\.]+$/u',
            ],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email:rfc,dns',
                'max:255',
                'unique:' . User::class . ',email',
            ],
            'password' => [
                'required',
                'confirmed',
                Rules\Password::min(8)
                    ->mixedCase()
                    ->numbers()
                    ->symbols()
                    ->uncompromised(),
            ],
        ], [
            'name.regex'             => 'El nombre solo puede contener letras, espacios, guiones y puntos.',
            'email.email'            => 'Ingresa un correo electrónico válido.',
            'email.unique'           => 'Este correo ya está registrado.',
            'password.confirmed'     => 'Las contraseñas no coinciden.',
            'password.min'           => 'La contraseña debe tener al menos 8 caracteres.',
            'password.mixed_case'    => 'La contraseña debe incluir mayúsculas y minúsculas.',
            'password.numbers'       => 'La contraseña debe incluir al menos un número.',
            'password.symbols'       => 'La contraseña debe incluir al menos un símbolo especial.',
            'password.uncompromised' => 'Esta contraseña fue detectada en filtraciones públicas. Elige una diferente.',
        ]);

        $user = User::create([
            'name'     => strip_tags(trim($request->name)),
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            // El rol NUNCA viene del request — siempre 'vendedor' por default (definido en la migración)
        ]);

        event(new Registered($user));

        // El admin que creó la cuenta NO pierde su propia sesión
        // (no llamamos a Auth::login() aquí porque el admin ya está logueado)

        return redirect()->route('admin.dashboard')
            ->with('success', "Usuario '{$user->name}' creado correctamente.");
    }
}
