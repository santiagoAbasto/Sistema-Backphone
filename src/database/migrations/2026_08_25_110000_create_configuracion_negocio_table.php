<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Datos del negocio: nombre, NIT, contacto y dirección.
 *
 * Se guarda como pares clave/valor para que sumar un dato nuevo no obligue a migrar la tabla.
 * Arranca solo con el nombre y la moneda; lo demás lo completa quien instale el sistema desde
 * Ajustes → Datos del negocio.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('configuracion_negocio', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 100)->unique();
            $table->text('valor')->nullable();
            $table->string('tipo', 30)->default('texto');   // texto, numero, booleano, json
            $table->string('grupo', 60)->default('identidad');
            $table->string('etiqueta', 200)->nullable();
            $table->timestamps();
        });

        $ahora = now();

        $filas = [
            ['negocio_nombre',    'Blackphone', 'identidad', 'Nombre del negocio'],
            ['negocio_eslogan',    null,        'identidad', 'Eslogan'],
            ['negocio_nit',        null,        'identidad', 'NIT o identificación tributaria'],
            ['moneda_simbolo',     'Bs',        'identidad', 'Símbolo de la moneda'],
            ['negocio_telefono',   null,        'contacto',  'Teléfono'],
            ['negocio_whatsapp',   null,        'contacto',  'WhatsApp'],
            ['negocio_email',      null,        'contacto',  'Correo de contacto'],
            ['negocio_direccion',  null,        'ubicacion', 'Dirección'],
            ['negocio_ciudad',     null,        'ubicacion', 'Ciudad'],
            ['negocio_pais',       null,        'ubicacion', 'País'],
            ['negocio_horario',    null,        'ubicacion', 'Horario de atención'],
        ];

        DB::table('configuracion_negocio')->insert(array_map(fn ($f) => [
            'clave'      => $f[0],
            'valor'      => $f[1],
            'tipo'       => 'texto',
            'grupo'      => $f[2],
            'etiqueta'   => $f[3],
            'created_at' => $ahora,
            'updated_at' => $ahora,
        ], $filas));
    }

    public function down(): void
    {
        Schema::dropIfExists('configuracion_negocio');
    }
};
