<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * La primera cuenta de administrador del sistema.
 *
 * Sale de `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en `.env`: acá no se
 * escribe ninguna contraseña ni ningún correo de una persona. Sin esas variables, el seeder no
 * hace nada y lo dice.
 *
 * Si la cuenta ya existe, **no** se le cambia la contraseña: volver a sembrar nunca pisa lo que
 * la persona haya configurado. El resto del equipo se crea desde Usuarios y roles, dentro del panel.
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        $nombre     = trim((string) env('SEED_ADMIN_NAME', 'Administrador'));
        $correo     = strtolower(trim((string) env('SEED_ADMIN_EMAIL', '')));
        $contrasena = (string) env('SEED_ADMIN_PASSWORD', '');

        if ($correo === '' || $contrasena === '') {
            $this->command?->warn(
                'UserSeeder: falta SEED_ADMIN_EMAIL o SEED_ADMIN_PASSWORD en .env. No se creó ninguna cuenta.'
            );

            return;
        }

        $existente = User::query()->whereRaw('LOWER(email) = ?', [$correo])->first();

        if ($existente) {
            $this->command?->info("UserSeeder: {$correo} ya existe. No se toca su contraseña.");

            return;
        }

        User::create([
            'name'     => $nombre !== '' ? $nombre : 'Administrador',
            'email'    => $correo,
            'password' => Hash::make($contrasena),
            'rol'      => 'admin',
        ]);

        $this->command?->info("UserSeeder: administrador {$correo} creado.");
    }
}
