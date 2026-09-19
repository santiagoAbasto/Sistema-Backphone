<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Los roles del sistema pasan a ser datos, no dos palabras escritas en el código.
 *
 * Hasta ahora `users.rol` guardaba «admin» o «vendedor» y cada ruta del panel comprobaba ese texto. La columna se
 * queda igual (nada se rompe), pero ahora cada valor tiene su fila acá, con su nombre, su explicación y los módulos
 * del panel de administración que puede abrir. `admin` y `vendedor` son del sistema y no se borran: `admin` siempre
 * lo puede todo, y `vendedor` no entra al panel de administración porque tiene el suyo en `/vendedor`, igual que
 * antes de esta migración.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40)->unique();        // lo que se guarda en users.rol
            $table->string('nombre', 60);
            $table->string('descripcion', 200)->nullable();
            $table->json('permisos');                      // ['*'] o las claves de App\Support\Permisos
            $table->boolean('del_sistema')->default(false);
            // El vendedor no entra al panel de administración: tiene el suyo, en /vendedor
            $table->boolean('panel_propio')->default(false);
            $table->boolean('activo')->default(true);
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });

        $ahora = now();
        DB::table('roles')->insert([
            [
                'clave'       => 'admin',
                'nombre'      => 'Administrador',
                'descripcion' => 'Entra a todo el panel, incluidos los precios de costo, los reportes y los usuarios.',
                'permisos'    => json_encode(['*']),
                'del_sistema' => true,
                'panel_propio' => false,
                'activo'      => true,
                'orden'       => 1,
                'created_at'  => $ahora,
                'updated_at'  => $ahora,
            ],
            [
                'clave'       => 'vendedor',
                'nombre'      => 'Vendedor',
                'descripcion' => 'Entra a su propio panel (/vendedor) para vender, cotizar y registrar servicios. No ve los costos ni el panel de administración.',
                // El vendedor nunca entró al panel de administración y sigue igual: su panel es otro
                'permisos'    => json_encode([]),
                'del_sistema' => true,
                'panel_propio' => true,
                'activo'      => true,
                'orden'       => 2,
                'created_at'  => $ahora,
                'updated_at'  => $ahora,
            ],
        ]);

        // Un usuario con un rol que no existía queda como vendedor, para que nadie quede sin panel
        DB::table('users')->whereNotIn('rol', ['admin', 'vendedor'])->update(['rol' => 'vendedor']);
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
