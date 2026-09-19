<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `users.rol` deja de ser una lista cerrada de dos palabras.
 *
 * La columna se creó como `enum('admin','vendedor')`, así que la base rechazaba cualquier rol nuevo: con el módulo
 * de Usuarios y roles se pueden crear los propios, y cada uno guarda su clave acá. Pasa a texto, con «vendedor» por
 * defecto; lo que vale como rol lo controla la tabla `roles` y la validación del panel, no la forma de la columna.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('rol', 40)->default('vendedor')->change();
        });
    }

    public function down(): void
    {
        // Volver al enum obliga a que no quede ningún rol propio en uso
        Schema::table('users', function (Blueprint $table) {
            $table->enum('rol', ['admin', 'vendedor'])->default('vendedor')->change();
        });
    }
};
