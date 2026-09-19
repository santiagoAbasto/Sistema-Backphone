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
        Schema::create('computadoras', function (Blueprint $table) {
            $table->id();
            $table->string('numero_serie')->unique();
            $table->string('nombre');
            $table->string('procesador')->nullable();
            $table->string('bateria')->nullable();
            $table->string('color');
            $table->string('ram');
            $table->string('almacenamiento');
            $table->string('procedencia');
            $table->decimal('precio_costo', 10, 2);
            $table->decimal('precio_venta', 10, 2);
            $table->enum('estado', ['disponible', 'vendido', 'permuta'])->default('disponible');
            $table->timestamps();
        });
    }
    

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('computadoras');
    }
};
