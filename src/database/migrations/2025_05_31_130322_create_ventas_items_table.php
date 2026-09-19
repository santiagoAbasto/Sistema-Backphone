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
        Schema::create('ventas_items', function (Blueprint $table) {
            $table->id();

            // Referencia a la venta
            $table->foreignId('venta_id')
                ->constrained('ventas')
                ->onDelete('cascade');

            // Tipo de producto: celular, computadora, producto_general
            $table->string('tipo');

            // ID del producto referenciado según tipo
            $table->unsignedBigInteger('producto_id');

            // Información de venta
            $table->integer('cantidad')->default(1);
            $table->decimal('precio_venta', 10, 2);
            $table->decimal('precio_invertido', 10, 2)->nullable();
            $table->decimal('descuento', 10, 2)->default(0);
            $table->decimal('subtotal', 10, 2);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ventas_items');
    }
};
