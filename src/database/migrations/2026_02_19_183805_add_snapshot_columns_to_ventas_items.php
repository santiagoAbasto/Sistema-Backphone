<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('ventas_items', function (Blueprint $table) {

            // 🔹 Identificación comercial
            $table->string('categoria')->nullable()->after('tipo');
            $table->string('nombre_producto')->nullable()->after('categoria');

            // 🔹 Celulares
            $table->string('modelo')->nullable()->after('nombre_producto');
            $table->string('capacidad')->nullable()->after('modelo');
            $table->string('color')->nullable()->after('capacidad');
            $table->integer('bateria')->nullable()->after('color');

            // 🔹 Computadoras
            $table->string('procesador')->nullable()->after('bateria');
            $table->string('ram')->nullable()->after('procesador');
            $table->string('almacenamiento')->nullable()->after('ram');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ventas_items', function (Blueprint $table) {
            //
        });
    }
};
