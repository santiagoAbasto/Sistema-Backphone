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
        Schema::create('productos_generales', function (Blueprint $table) {
            $table->id();
            $table->string('codigo')->unique(); // por ejemplo: VDT123, ACC004
            $table->string('tipo'); // ej: vidrio_templado, accesorio, funda, cargador_5w
            $table->string('nombre')->nullable(); // para accesorios, cargadores
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
        Schema::dropIfExists('producto_generals');
    }
};
