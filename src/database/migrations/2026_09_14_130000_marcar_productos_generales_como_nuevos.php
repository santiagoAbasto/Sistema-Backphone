<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Los productos generales (accesorios) son todos nuevos: se marcan así en el inventario.
 * Celulares, computadoras y productos de marca los actualiza el equipo uno por uno.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('productos_generales')
            ->whereNull('condicion')
            ->update(['condicion' => 'Nuevo']);
    }

    public function down(): void
    {
        // Sin vuelta atrás: antes no tenían condición (la columna se quita con la migración anterior)
    }
};
