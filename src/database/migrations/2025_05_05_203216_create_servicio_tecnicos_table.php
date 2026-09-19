<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('servicio_tecnicos', function (Blueprint $table) {
            $table->id();

            // Código automático de Servicio Técnico (AT-ST###)
            $table->string('codigo_nota', 20)
                ->unique()
                ->comment('Código interno de servicio técnico');

            // Datos del cliente
            $table->string('cliente');
            $table->string('telefono')->nullable();

            // Detalle del servicio
            $table->string('equipo');
            $table->text('detalle_servicio');

            // 📝 Notas adicionales (visible en boleta)
            $table->text('notas_adicionales')->nullable();

            // Costos
            $table->decimal('precio_costo', 10, 2)->default(0);
            $table->decimal('precio_venta', 10, 2)->default(0);

            // Técnico responsable
            $table->string('tecnico');

            // Fecha del servicio
            $table->date('fecha');

            // Usuario que registró
            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            // Relación opcional con venta
            $table->foreignId('venta_id')
                ->nullable()
                ->constrained('ventas')
                ->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('servicio_tecnicos');
    }
};
