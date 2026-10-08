<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Crea la cuenta que administra todo: rol admin y sin sucursal, que es lo que la deja ver y
 * moverse entre todas las sucursales. Es la primera cuenta de una instalación; el resto del
 * equipo se crea desde Usuarios y roles.
 *
 * La contraseña se pide por teclado y no se ve al escribirla: no pasa por la línea de comandos,
 * ni por el historial de la terminal, ni por el .env.
 *
 *   php artisan usuarios:super-admin axel@blackphone.com.bo
 */
class CrearSuperAdmin extends Command
{
    protected $signature = 'usuarios:super-admin {email} {--nombre= : Nombre que se muestra en el panel (por defecto, lo que va antes de la @)}';

    protected $description = 'Crea una cuenta de super administrador pidiendo la contraseña sin mostrarla.';

    public function handle(): int
    {
        $email  = strtolower(trim((string) $this->argument('email')));
        $nombre = trim((string) $this->option('nombre')) ?: ucfirst((string) strstr($email, '@', true));

        if (Validator::make(['email' => $email], ['email' => ['required', 'email:rfc', 'max:191']])->fails()) {
            $this->error("«{$email}» no es un correo válido.");

            return self::FAILURE;
        }

        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            $this->error("Ya existe una cuenta con {$email}. No se cambió nada.");

            return self::FAILURE;
        }

        $clave    = (string) $this->secret('Contraseña (no se ve al escribirla)');
        $repetida = (string) $this->secret('Repite la contraseña');

        // La misma regla que pide el panel al crear una cuenta.
        $validacion = Validator::make(
            ['password' => $clave, 'password_confirmation' => $repetida],
            ['password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()]],
        );

        if ($validacion->fails()) {
            foreach ($validacion->errors()->all() as $error) {
                $this->error($error);
            }
            $this->line('No se creó ninguna cuenta.');

            return self::FAILURE;
        }

        $usuario = new User(['name' => $nombre, 'email' => $email, 'password' => $clave]);
        // Ni 'rol' ni 'sucursal_id' son asignables masivamente: van uno por uno, a propósito.
        $usuario->rol               = 'admin';
        $usuario->sucursal_id       = null;
        $usuario->email_verified_at = now();
        $usuario->save();

        $this->info("Listo: {$nombre} ({$email}) es super administrador.");
        $this->line('Entra con ese correo y la contraseña que acabas de escribir.');

        return self::SUCCESS;
    }
}
