<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('secuencias', function (Blueprint $table) {
            $table->id();
            $table->string('clave')->unique(); // ej: ventas, servicio_tecnico
            $table->unsignedBigInteger('ultimo_numero')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('secuencias');
    }
};
