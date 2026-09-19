<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Condición comercial del inventario (Nuevo / Seminuevo).
 * Arranca vacía en todos los productos: la elige quien carga o edita cada uno, nunca se inventa.
 */
return new class extends Migration
{
    private const TABLAS = [
        'celular'          => 'celulares',
        'computadora'      => 'computadoras',
        'producto_apple'   => 'productos_apple',
        'producto_general' => 'productos_generales',
    ];

    public function up(): void
    {
        foreach (self::TABLAS as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->string('condicion', 20)->nullable()->after('estado');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLAS as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->dropColumn('condicion');
            });
        }
    }
};
