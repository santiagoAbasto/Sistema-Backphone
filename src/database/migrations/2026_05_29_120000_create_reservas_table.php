<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservas', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_nota', 12)->unique()->nullable();
            $table->string('nombre_cliente');
            $table->string('telefono_cliente')->nullable();
            $table->dateTime('fecha')->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('monto_reserva', 10, 2);
            $table->text('terminos_condiciones')->nullable();
            $table->enum('estado', ['activa', 'vendida', 'cancelada', 'vencida'])->default('activa');
            $table->foreignId('venta_id')->nullable()->constrained('ventas')->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('reserva_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reserva_id')->constrained('reservas')->cascadeOnDelete();
            $table->string('tipo');
            $table->unsignedBigInteger('producto_id');
            $table->integer('cantidad')->default(1);
            $table->decimal('precio_venta', 10, 2);
            $table->decimal('descuento', 10, 2)->default(0);
            $table->decimal('subtotal', 10, 2);
            $table->string('categoria')->nullable();
            $table->string('nombre_producto')->nullable();
            $table->string('modelo')->nullable();
            $table->string('capacidad')->nullable();
            $table->string('color')->nullable();
            $table->string('bateria')->nullable();
            $table->string('procesador')->nullable();
            $table->string('ram')->nullable();
            $table->string('almacenamiento')->nullable();
            $table->timestamps();
        });

        Schema::table('ventas', function (Blueprint $table) {
            $table->foreignId('reserva_id')->nullable()->after('codigo_nota')->constrained('reservas')->nullOnDelete();
            $table->decimal('monto_reserva_aplicado', 10, 2)->default(0)->after('valor_permuta');
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reserva_id');
            $table->dropColumn('monto_reserva_aplicado');
        });

        Schema::dropIfExists('reserva_items');
        Schema::dropIfExists('reservas');
    }
};
