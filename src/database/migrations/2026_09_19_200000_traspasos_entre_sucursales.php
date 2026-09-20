<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mover inventario de una sucursal a la otra.
 *
 * Entre Cochabamba y Sucre hay días de por medio. Por eso un traspaso no es un cambio instantáneo
 * de dueño: lo que sale queda «en tránsito» —fuera de la venta en las dos sucursales— hasta que
 * la de destino confirma que llegó. Mientras viaja sigue siendo de quien lo envió, así que si el
 * envío se cancela no hay nada que deshacer.
 *
 * El traspaso es de las dos sucursales a la vez, así que esta tabla no lleva el filtro de
 * sucursal: se consulta por origen o destino.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('traspasos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 20)->unique();

            $table->foreignId('origen_sucursal_id')->constrained('sucursales')->cascadeOnDelete();
            $table->foreignId('destino_sucursal_id')->constrained('sucursales')->cascadeOnDelete();

            // en_transito | recibido | cancelado
            $table->string('estado', 12)->default('en_transito');
            $table->text('nota')->nullable();

            $table->foreignId('enviado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('enviado_en')->nullable();
            $table->foreignId('recibido_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recibido_en')->nullable();

            $table->timestamps();

            $table->index(['destino_sucursal_id', 'estado']);
            $table->index(['origen_sucursal_id', 'estado']);
        });

        Schema::create('traspaso_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('traspaso_id')->constrained('traspasos')->cascadeOnDelete();

            // celular | computadora | producto_apple | producto_general | pieza
            $table->string('tipo', 20);
            $table->unsignedBigInteger('producto_id');
            // Solo las piezas van de a varias; el resto del inventario es una unidad por registro.
            $table->unsignedInteger('cantidad')->default(1);

            // La foto de qué se envió: si el producto se edita después, el remito no cambia.
            $table->string('nombre', 200);
            $table->string('detalle', 200)->nullable();

            $table->timestamps();

            $table->index(['tipo', 'producto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('traspaso_items');
        Schema::dropIfExists('traspasos');
    }
};
