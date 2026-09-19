<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cómo llegó el equipo al taller.
 *
 * Es la mitad que faltaba de la nota de servicio. Hasta ahora se anotaba qué se le iba a hacer al
 * equipo, pero no en qué estado entró: si encendía, si la pantalla ya venía rajada, si el cliente
 * dejó el código de desbloqueo. Eso es justamente lo que se discute cuando el cliente vuelve, y
 * por eso se guarda punto por punto y sale impreso en la nota que firman los dos.
 *
 * Va en un JSON y no en columnas sueltas porque la lista no es fija: cada taller revisa lo suyo y
 * puede agregar un punto en el mostrador sin que nadie toque la base.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->json('recepcion')->nullable()->after('notas_adicionales');
        });
    }

    public function down(): void
    {
        Schema::table('servicio_tecnicos', fn (Blueprint $table) => $table->dropColumn('recepcion'));
    }
};
