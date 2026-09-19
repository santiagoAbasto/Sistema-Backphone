<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('ventas', function (Blueprint $table) {
            $table->id();

            // Información del cliente
            $table->string('nombre_cliente');
            $table->string('telefono_cliente')->nullable();
            $table->date('fecha')->nullable();

            // Código de nota de talonario
            $table->string('codigo_nota', 10)
                ->unique()
                ->nullable()
                ->comment('Código corto de venta ej: AT-V101');
            // Tipo de venta
            $table->enum('tipo_venta', ['producto', 'servicio_tecnico']);

            // Permuta
            $table->boolean('es_permuta')->default(false);
            $table->enum('tipo_permuta', ['celular', 'computadora', 'producto_general'])->nullable();

            // Detalles de venta
            $table->unsignedInteger('cantidad')->default(1);
            $table->decimal('precio_invertido', 10, 2)->default(0);
            $table->decimal('precio_venta', 10, 2);
            $table->decimal('ganancia_neta', 10, 2)->default(0);
            $table->decimal('subtotal', 10, 2);
            $table->decimal('descuento', 10, 2)->default(0);

            // Producto vendido
            $table->unsignedBigInteger('celular_id')->nullable();
            $table->unsignedBigInteger('computadora_id')->nullable();
            $table->unsignedBigInteger('producto_general_id')->nullable();

            // Producto entregado en permuta (nuevo)
            $table->unsignedBigInteger('entregado_celular_id')->nullable();
            $table->unsignedBigInteger('entregado_computadora_id')->nullable();
            $table->unsignedBigInteger('entregado_producto_general_id')->nullable();

            // Método de pago
            $table->enum('metodo_pago', ['efectivo', 'qr', 'tarjeta'])->default('efectivo');
            $table->string('inicio_tarjeta')->nullable();
            $table->string('fin_tarjeta')->nullable();
            $table->text('notas_adicionales')->nullable();

            // Usuario vendedor
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ventas');
    }
};
