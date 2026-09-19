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
        Schema::create('egresos', function (Blueprint $table) {
            $table->id();
            $table->string('concepto');
            $table->decimal('precio_invertido', 10, 2);
            $table->enum('tipo_gasto', ['servicio_basico', 'cuota_bancaria', 'gasto_personal', 'sueldos']);
            $table->string('frecuencia')->nullable(); // Ej: Mensual, Único
            $table->unsignedTinyInteger('cuotas_pendientes')->nullable(); // Solo si aplica
            $table->string('comentario')->nullable(); // Comentario adicional
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->timestamps();
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('egresos');
    }
};
