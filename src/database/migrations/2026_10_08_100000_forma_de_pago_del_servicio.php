<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cómo pagó el cliente un servicio técnico. Hasta ahora no se guardaba y el Resumen contaba
 * todo servicio como efectivo, así que «Efectivo en caja» salía inflado con lo cobrado por QR,
 * transferencia o tarjeta.
 *
 * Va como string y no como enum a propósito: en PostgreSQL un enum es un CHECK que SQLite (donde
 * corren las pruebas) no tiene, y una forma de pago nueva pasaría las pruebas y fallaría en
 * producción. Los valores válidos los controla ServicioTecnico::METODOS_PAGO.
 *
 * Los servicios que ya existían quedan en efectivo, que es como se venían contando.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->string('metodo_pago', 20)->default('efectivo')->after('precio_venta');
        });
    }

    public function down(): void
    {
        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->dropColumn('metodo_pago');
        });
    }
};
