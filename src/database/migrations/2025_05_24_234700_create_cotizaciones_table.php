<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cotizaciones', function (Blueprint $table) {
            $table->id();

            // ✅ dueño (vendedor o admin que creó la cotización)
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // ✅ cliente asociado (del mismo user_id)
            $table->foreignId('cliente_id')->nullable()->constrained('clientes')->nullOnDelete();

            // Snapshot del cliente (para historial estable)
            $table->string('nombre_cliente');
            $table->string('telefono')->nullable();
            $table->string('correo_cliente')->nullable();

            // Detalle de ítems cotizados
            $table->json('items');

            // Totales
            $table->decimal('descuento', 10, 2)->default(0);
            $table->decimal('total', 10, 2);

            // Link al PDF en Google Drive
            $table->string('drive_url')->nullable();

            // Información adicional
            $table->text('notas_adicionales')->nullable();
            $table->date('fecha_cotizacion');

            // Estado de envío
            $table->boolean('enviado_por_correo')->default(false);
            $table->boolean('enviado_por_whatsapp')->default(false);

            $table->timestamps();

            // ✅ índices útiles
            $table->index(['user_id', 'fecha_cotizacion']);
            $table->index(['cliente_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cotizaciones');
    }
};
