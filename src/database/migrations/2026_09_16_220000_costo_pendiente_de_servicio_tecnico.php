<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Servicio técnico: el vendedor registra solo lo que cobra al cliente y el administrador carga el costo después.
 *
 * - `costo_pendiente`: el servicio todavía no tiene costo; su utilidad no se suma en ningún reporte.
 * - `costo_cargado_por` y `costo_cargado_en`: quién completó el costo y cuándo (la nota del cliente no cambia).
 * - `system_notifications.servicio_tecnico_id`: el aviso del Resumen lleva al servicio y se apaga al cargar el costo.
 *
 * Los servicios que ya existen tienen su costo cargado, así que quedan sin pendiente.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->boolean('costo_pendiente')->default(false)->index();
            $table->unsignedBigInteger('costo_cargado_por')->nullable();
            $table->timestamp('costo_cargado_en')->nullable();
        });

        if (Schema::hasTable('system_notifications') && ! Schema::hasColumn('system_notifications', 'servicio_tecnico_id')) {
            Schema::table('system_notifications', function (Blueprint $table) {
                $table->unsignedBigInteger('servicio_tecnico_id')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('system_notifications') && Schema::hasColumn('system_notifications', 'servicio_tecnico_id')) {
            Schema::table('system_notifications', function (Blueprint $table) {
                $table->dropIndex(['servicio_tecnico_id']);
                $table->dropColumn('servicio_tecnico_id');
            });
        }

        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->dropIndex(['costo_pendiente']);
            $table->dropColumn(['costo_pendiente', 'costo_cargado_por', 'costo_cargado_en']);
        });
    }
};
