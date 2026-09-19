<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La foto de perfil de cada cuenta.
 *
 * Se guarda la ruta dentro del disco público, no la imagen: `perfil/ab12cd.jpg`. Sin foto, el
 * panel dibuja las iniciales, que es lo que había hasta ahora.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('foto', 200)->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('foto'));
    }
};
